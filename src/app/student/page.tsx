import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  KeyRound,
  MessagesSquare,
  PlayCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
} from '@/components/ui/card';
import {
  Alert,
  Badge,
  EmptyState,
  Progress,
  ProgressRing,
} from '@/components/ui/feedback';
import { MaterialIcon, SubjectIcon } from '@/components/student/subject-icon';
import { guardStudent } from '@/lib/auth/guards';
import { getStudentDashboard } from '@/lib/data/student';
import { formatDateTime, formatPercent, formatRelative } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function StudentDashboardPage() {
  const user = await guardStudent();
  const student = user.student;

  // Two states come before any content: no class chosen, and not yet activated.
  // Each gets a dedicated, encouraging screen rather than an empty dashboard.
  if (!student?.classId) {
    return <ChooseClassPrompt firstName={firstName(user.fullName)} />;
  }
  if (!student.isActivated) {
    return (
      <AwaitingActivationPrompt
        firstName={firstName(user.fullName)}
        className={student.className}
      />
    );
  }

  const data = await getStudentDashboard(user);

  return (
    <div className="space-y-6">
      {/* --- Greeting ------------------------------------------------- */}
      <section className="brand-wash overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-soft)] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <Badge tone="brand" className="mb-3">
              {student.className}
            </Badge>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {greeting()}, {firstName(user.fullName)}.
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-[var(--text-body)]">
              {data.availableExams.length > 0
                ? `You have ${data.availableExams.length} examination${
                    data.availableExams.length === 1 ? '' : 's'
                  } open right now.`
                : data.totalCompleted === 0
                  ? 'Open your first lesson and start building your progress.'
                  : `You have finished ${data.totalCompleted} of ${data.totalMaterials} lessons. Keep going.`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={data.overallProgress} size={72} strokeWidth={6} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Overall progress
              </p>
              <p className="font-display text-xl font-bold text-[var(--text-strong)]">
                {formatPercent(data.overallProgress, 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Statistics ----------------------------------------------- */}
      <section className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Subjects"
          value={data.subjects.length}
          hint={`${data.subjects.reduce((sum, s) => sum + s.topicCount, 0)} topics in total`}
          icon={<BookOpen className="size-5" aria-hidden />}
        />
        <StatCard
          label="Lessons completed"
          value={`${data.totalCompleted}/${data.totalMaterials}`}
          hint={`${formatPercent(data.overallProgress, 0)} of your class material`}
          icon={<CheckCircle2 className="size-5" aria-hidden />}
          tone="success"
        />
        <StatCard
          label="Examinations open"
          value={data.availableExams.length}
          hint={
            data.upcomingExams.length > 0
              ? `${data.upcomingExams.length} more coming up`
              : 'Nothing else scheduled'
          }
          icon={<FileText className="size-5" aria-hidden />}
          tone={data.availableExams.length > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="Average score"
          value={data.averageScore === null ? '—' : formatPercent(data.averageScore)}
          hint={
            data.results.length === 0
              ? 'No results yet'
              : `From your last ${data.results.length} result${data.results.length === 1 ? '' : 's'}`
          }
          icon={<TrendingUp className="size-5" aria-hidden />}
          tone="brand"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Main column ------------------------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* Continue learning */}
          <Card>
            <CardHeader>
              <CardTitle>Continue where you left off</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/student/subjects">
                  All subjects
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentLessons.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<PlayCircle className="size-6" aria-hidden />}
                    title="You have not opened a lesson yet"
                    description="Pick a subject and start with the first topic. Your progress saves automatically."
                    action={
                      <Button asChild>
                        <Link href="/student/subjects">Browse subjects</Link>
                      </Button>
                    }
                    className="border-0 py-8"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.recentLessons.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/student/lessons/${entry.material.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-sunken)]"
                      >
                        <MaterialIcon type={entry.material.type} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">
                            {entry.material.title}
                          </span>
                          <span className="block truncate text-xs text-[var(--text-muted)]">
                            {entry.material.subject.name} · {entry.material.topic.title}{' '}
                            · {formatRelative(entry.updatedAt)}
                          </span>
                        </span>
                        {entry.status === 'COMPLETED' ? (
                          <Badge tone="success" dot>
                            Done
                          </Badge>
                        ) : (
                          <span className="hidden w-24 shrink-0 sm:block">
                            <Progress value={entry.progressPercent} size="sm" />
                          </span>
                        )}
                        <ArrowRight
                          className="size-4 shrink-0 text-[var(--text-muted)]"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Subjects */}
          <Card>
            <CardHeader>
              <CardTitle>Your subjects</CardTitle>
            </CardHeader>
            <CardContent>
              {data.subjects.length === 0 ? (
                <EmptyState
                  title="No subjects yet"
                  description="Your class does not have any subjects assigned. Please tell your teacher."
                  className="border-0 py-8"
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.subjects.map((subject) => (
                    <Link
                      key={subject.id}
                      href={`/student/subjects/${subject.slug}`}
                      className="group flex items-start gap-3 rounded-[var(--radius-field)] border border-[var(--line-soft)] p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-soft)]"
                    >
                      <SubjectIcon
                        iconKey={subject.iconKey}
                        colorKey={subject.colorKey}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[var(--text-strong)]">
                          {subject.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                          {subject.topicCount} topic
                          {subject.topicCount === 1 ? '' : 's'} ·{' '}
                          {subject.materialCount} lesson
                          {subject.materialCount === 1 ? '' : 's'}
                        </span>
                        <Progress
                          value={subject.progressPercent}
                          size="sm"
                          className="mt-2.5"
                        />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Side column -------------------------------------------- */}
        <div className="space-y-6">
          {/* Examinations */}
          <Card>
            <CardHeader>
              <CardTitle>Examinations</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/student/exams">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.availableExams.length === 0 && data.upcomingExams.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                  No examinations are scheduled right now.
                </p>
              ) : null}

              {data.availableExams.slice(0, 3).map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-[var(--radius-field)] border border-warn-500/30 bg-warn-50 p-3.5 dark:bg-warn-700/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                        {exam.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {exam.subjectName} · {exam.durationMins} minutes ·{' '}
                        {exam.totalQuestions} questions
                      </p>
                    </div>
                    <Badge tone="warn">
                      {exam.openAttemptId ? 'In progress' : 'Open'}
                    </Badge>
                  </div>
                  <Button asChild size="sm" block className="mt-3">
                    <Link href={`/student/exams/${exam.id}`}>
                      {exam.openAttemptId ? 'Resume examination' : 'Start examination'}
                    </Link>
                  </Button>
                </div>
              ))}

              {data.upcomingExams.slice(0, 2).map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-[var(--line-soft)] p-3.5"
                >
                  <CalendarClock
                    className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                      {exam.title}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Opens {formatDateTime(exam.availableFrom)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent results */}
          <Card>
            <CardHeader>
              <CardTitle>Recent results</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/student/results">All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.results.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                  Your results will appear here after your first examination.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {data.results.map((result) => (
                    <li key={result.id}>
                      <Link
                        href={`/student/results/${result.attemptId}`}
                        className="flex items-center gap-3 rounded-[var(--radius-field)] p-2 transition-colors hover:bg-[var(--surface-sunken)]"
                      >
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${
                            result.passed
                              ? 'bg-success-50 text-success-700 dark:bg-success-700/15 dark:text-success-500'
                              : 'bg-danger-50 text-danger-700 dark:bg-danger-700/15 dark:text-danger-500'
                          }`}
                          aria-hidden
                        >
                          {result.exam.showResultInstantly ? result.grade : '—'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">
                            {result.exam.title}
                          </span>
                          <span className="block text-xs text-[var(--text-muted)]">
                            {result.exam.showResultInstantly
                              ? `${result.score}/${result.totalMarks} · ${formatPercent(result.percentage)}`
                              : 'Awaiting release'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Forum */}
          {data.forumCategory ? (
            <Card interactive>
              <Link href={`/forum/${data.forumCategory.slug}`} className="block p-5">
                <span className="mb-3 grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <MessagesSquare className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-bold text-[var(--text-strong)]">
                  {data.forumCategory.name}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {data.forumCategory._count.posts} discussion
                  {data.forumCategory._count.posts === 1 ? '' : 's'} · ask a
                  question or help a classmate.
                </p>
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pre-dashboard states
// -----------------------------------------------------------------------------

function ChooseClassPrompt({ firstName: name }: { firstName: string }) {
  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="text-center">
        <span
          className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
          aria-hidden
        >
          <Sparkles className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          One more step, {name}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Tell us which class you are in, so we can show you the right subjects,
          lessons and examinations.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/student/select-class">
            Choose my class
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AwaitingActivationPrompt({
  firstName: name,
  className,
}: {
  firstName: string;
  className: string | null;
}) {
  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="text-center">
        <span
          className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-warn-50 text-warn-700 dark:bg-warn-700/15 dark:text-warn-500"
          aria-hidden
        >
          <KeyRound className="size-7" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Almost there, {name}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Your account{className ? ` in ${className}` : ''} is registered but not
          yet activated. Enter the access code your school gave you to open your
          subjects, lessons and examinations.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/student/activate">
            Enter my access code
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <Alert tone="info" className="mt-8" title="Do not have a code yet?">
        Ask your class teacher or the school office. Codes are issued to one
        student only and stop working once used.
      </Alert>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <WaitingTile
          icon={<BookOpen className="size-5" aria-hidden />}
          label="Lessons"
        />
        <WaitingTile icon={<FileText className="size-5" aria-hidden />} label="Examinations" />
        <WaitingTile icon={<Award className="size-5" aria-hidden />} label="Results" />
      </div>
    </div>
  );
}

function WaitingTile({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-field)] border border-dashed border-[var(--line-strong)] px-4 py-5 text-center opacity-70">
      <span className="text-[var(--text-muted)]" aria-hidden>
        {icon}
      </span>
      <span className="text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      <span className="text-[0.625rem] uppercase tracking-wide text-[var(--text-muted)]">
        Locked
      </span>
    </div>
  );
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
