import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Repeat,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Alert, Badge } from '@/components/ui/feedback';
import { Breadcrumb, DescriptionList } from '@/components/ui/misc';
import { RichText } from '@/components/forum/rich-text';
import { guardLearningAccess } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getExamAvailability } from '@/lib/exam/engine';
import { EXAM_STATUS } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ examId: string }>;
}): Promise<Metadata> {
  const { examId } = await params;
  const exam = await prisma.examination.findUnique({
    where: { id: examId },
    select: { title: true },
  });
  return { title: exam?.title ?? 'Examination' };
}

/**
 * The briefing screen.
 *
 * Deliberately a separate page from the paper itself: the timer starts when the
 * attempt is created, so the student must have a chance to read the rules,
 * check their connection and decide to begin — not be dropped into a running
 * clock by a mis-tap.
 */
export default async function ExamBriefingPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const user = await guardLearningAccess();
  const { examId } = await params;

  const exam = await prisma.examination.findFirst({
    where: {
      id: examId,
      classId: user.student?.classId ?? '',
      status: EXAM_STATUS.PUBLISHED,
    },
    include: {
      subject: { select: { name: true } },
      schoolClass: { select: { name: true } },
    },
  });

  if (!exam) notFound();

  const availability = await getExamAvailability(exam.id, user.id);
  const attemptsLeft = Math.max(0, exam.attemptLimit - availability.attemptsUsed);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Examinations', href: '/student/exams' },
              { label: exam.title },
            ]}
          />
        }
        title={exam.title}
        description={`${exam.subject.name} · ${exam.schoolClass.name}`}
        actions={
          availability.hasOpenAttempt ? (
            <Badge tone="warn" dot>
              Attempt in progress
            </Badge>
          ) : null
        }
      />

      {availability.hasOpenAttempt ? (
        <Alert tone="warn" className="mb-5" title="You have an unfinished attempt">
          Your timer has been running since you opened the paper. Resume it now —
          it will be submitted automatically when the time runs out.
        </Alert>
      ) : null}

      {!availability.available && !availability.hasOpenAttempt ? (
        <Alert tone="danger" className="mb-5" title="You cannot start this paper">
          {availability.reason}
        </Alert>
      ) : null}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle as="h2">At a glance</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionList
            columns={3}
            items={[
              {
                term: 'Duration',
                description: (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4 text-brand-600" aria-hidden />
                    {exam.durationMins} minutes
                  </span>
                ),
              },
              {
                term: 'Questions',
                description: (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-4 text-brand-600" aria-hidden />
                    {exam.totalQuestions}
                  </span>
                ),
              },
              {
                term: 'Total marks',
                description: String(exam.totalMarks),
              },
              {
                term: 'Pass mark',
                description: `${exam.passMark}%`,
              },
              {
                term: 'Attempts',
                description: (
                  <span className="inline-flex items-center gap-1.5">
                    <Repeat className="size-4 text-brand-600" aria-hidden />
                    {availability.attemptsUsed} of {exam.attemptLimit} used
                  </span>
                ),
              },
              {
                term: 'Closes',
                description: exam.availableTo
                  ? formatDateTime(exam.availableTo)
                  : 'No closing date',
              },
            ]}
          />
        </CardContent>
      </Card>

      {exam.instructions ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle as="h2">Instructions from your teacher</CardTitle>
          </CardHeader>
          <CardContent>
            <RichText text={exam.instructions} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle as="h2">Before you begin</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <Rule
              icon={<Clock className="size-4" aria-hidden />}
              title="The clock starts the moment you open the paper"
              body={`You have ${exam.durationMins} minutes. Closing the tab does not stop it, and the paper submits itself when the time is up.`}
            />
            <Rule
              icon={<CheckCircle2 className="size-4" aria-hidden />}
              title="Your answers save as you go"
              body="Each answer is saved the instant you choose it. If your browser reloads, you can carry on from the same question."
            />
            <Rule
              icon={<Wifi className="size-4" aria-hidden />}
              title="A brief loss of connection is survivable"
              body="Answers you have already chosen are safe on the server. Reconnect and keep going."
            />
            <Rule
              icon={<ShieldCheck className="size-4" aria-hidden />}
              title="Marking happens on the server"
              body="Nothing in your browser knows the correct answers, and your score is calculated after you submit."
            />
            <Rule
              icon={<AlertTriangle className="size-4" aria-hidden />}
              title={
                exam.attemptLimit === 1
                  ? 'You have one attempt only'
                  : `You have ${exam.attemptLimit} attempts`
              }
              body={
                attemptsLeft <= 1
                  ? 'Once you submit this attempt, you cannot take the paper again.'
                  : `${attemptsLeft} attempts remain after this one is used.`
              }
            />
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {availability.available || availability.hasOpenAttempt ? (
          <Button asChild size="xl">
            <Link href={`/student/exams/${exam.id}/take`}>
              {availability.hasOpenAttempt
                ? 'Resume examination'
                : 'I am ready — start the examination'}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
        <Button asChild size="xl" variant="secondary">
          <Link href="/student/exams">Back to examinations</Link>
        </Button>
      </div>
    </div>
  );
}

function Rule({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        aria-hidden
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold text-[var(--text-strong)]">{title}</span>
        <span className="block text-[var(--text-muted)]">{body}</span>
      </span>
    </li>
  );
}
