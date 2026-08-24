import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
} from '@/components/ui/card';
import { Alert, Badge, Progress } from '@/components/ui/feedback';
import { PersonCell } from '@/components/ui/misc';
import { ClassPerformanceChart } from '@/components/charts/class-performance-chart';
import { getSuperAdminDashboard } from '@/lib/data/admin';
import { ACCESS_CODE_STATUS, TASK_PRIORITY_LABELS } from '@/lib/constants';
import { formatDate, formatPercent, formatRelative } from '@/lib/utils';
import type { AuthUser } from '@/lib/auth/types';

type DashboardData = Awaited<ReturnType<typeof getSuperAdminDashboard>>;

export function SuperAdminDashboard({
  data,
  user,
}: {
  data: DashboardData;
  user: AuthUser;
}) {
  const awaitingActivation = data.students.awaiting;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${user.fullName.split(' ')[0]}`}
        description="Everything happening across Fodan College right now."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/manage/codes">
                <KeyRound className="size-4" aria-hidden />
                Generate codes
              </Link>
            </Button>
            <Button asChild>
              <Link href="/manage/examinations/import">
                <FileText className="size-4" aria-hidden />
                Import examination
              </Link>
            </Button>
          </>
        }
      />

      {awaitingActivation > 0 ? (
        <Alert
          tone="warn"
          title={`${awaitingActivation} student${awaitingActivation === 1 ? '' : 's'} waiting for activation`}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href="/manage/students?status=awaiting">Review them</Link>
            </Button>
          }
        >
          They have registered but cannot open any lesson until an access code is
          issued and redeemed.
        </Alert>
      ) : null}

      {/* --- Headline numbers ----------------------------------------- */}
      <section className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={data.students.total}
          hint={`${data.students.activated} activated · ${data.students.awaiting} waiting`}
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <StatCard
          label="Administrators"
          value={data.admins.total}
          hint={`${data.admins.active} active`}
          icon={<ShieldCheck className="size-5" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="Learning materials"
          value={data.content.materials}
          hint={`${data.content.subjects} subjects · ${data.content.classes} classes`}
          icon={<BookOpen className="size-5" aria-hidden />}
          tone="success"
        />
        <StatCard
          label="Average performance"
          value={
            data.exams.averageScore === null
              ? '—'
              : formatPercent(data.exams.averageScore)
          }
          hint={`${data.exams.resultCount} result${data.exams.resultCount === 1 ? '' : 's'} recorded`}
          icon={<TrendingUp className="size-5" aria-hidden />}
          tone={
            data.exams.averageScore !== null && data.exams.averageScore < 40
              ? 'danger'
              : 'brand'
          }
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Examinations"
          value={data.exams.total}
          hint={`${data.exams.published} published`}
          icon={<FileText className="size-5" aria-hidden />}
          tone="neutral"
        />
        <StatCard
          label="Exams completed"
          value={data.exams.attemptsCompleted}
          hint="Submitted attempts"
          icon={<Activity className="size-5" aria-hidden />}
          tone="neutral"
        />
        <StatCard
          label="Active access codes"
          value={data.codes[ACCESS_CODE_STATUS.ACTIVE] ?? 0}
          hint={`${data.codes[ACCESS_CODE_STATUS.USED] ?? 0} used · ${data.codes[ACCESS_CODE_STATUS.EXPIRED] ?? 0} expired`}
          icon={<KeyRound className="size-5" aria-hidden />}
          tone="neutral"
        />
        <StatCard
          label="Open admin tasks"
          value={data.pendingTasks.length}
          hint="Assigned and not yet completed"
          icon={<ClipboardList className="size-5" aria-hidden />}
          tone={data.pendingTasks.length > 0 ? 'warn' : 'neutral'}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* --- Performance chart ---------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Average score by class</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/manage/results">Full analytics</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ClassPerformanceChart
                data={data.classPerformance.map((row) => ({
                  name: row.name,
                  average: row.average,
                  count: row.count,
                }))}
              />
            </CardContent>
          </Card>

          {/* --- Activity ------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/manage/audit">Full audit log</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-[var(--line-soft)]">
                {data.recentActivity.length === 0 ? (
                  <li className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                    Nothing recorded yet.
                  </li>
                ) : null}

                {data.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        entry.severity === 'CRITICAL'
                          ? 'bg-danger-600'
                          : entry.severity === 'WARNING'
                            ? 'bg-warn-500'
                            : 'bg-brand-500'
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--text-body)]">
                        {entry.description ?? entry.action}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {entry.actorUsername ? `@${entry.actorUsername} · ` : ''}
                        <span className="font-mono">{entry.action}</span> ·{' '}
                        {formatRelative(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* --- Activation progress -------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Student activation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={data.students.activationRate}
                label={`${data.students.activated} of ${data.students.total} activated`}
                showValue
                tone={data.students.activationRate > 80 ? 'success' : 'brand'}
                size="lg"
              />
              <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                <Tally label="Activated" value={data.students.activated} tone="success" />
                <Tally label="Waiting" value={data.students.awaiting} tone="warn" />
                <Tally label="Disabled" value={data.students.disabled} tone="danger" />
              </dl>
              <Button asChild variant="secondary" block size="sm">
                <Link href="/manage/students">Manage students</Link>
              </Button>
            </CardContent>
          </Card>

          {/* --- New registrations ---------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>New this week</CardTitle>
              <Badge tone="neutral">{data.recentRegistrations.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentRegistrations.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                  No new registrations in the last seven days.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.recentRegistrations.map((student) => (
                    <li key={student.id} className="px-5 py-3">
                      <PersonCell
                        name={student.fullName}
                        href={`/manage/students/${student.id}`}
                        secondary={
                          <>
                            {student.studentProfile?.schoolClass?.name ??
                              'No class yet'}{' '}
                            · {formatRelative(student.createdAt)}
                          </>
                        }
                      />
                      {!student.studentProfile?.isActivated ? (
                        <Badge tone="warn" className="mt-1.5">
                          <UserPlus className="size-3" aria-hidden />
                          Needs a code
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Expiring codes ------------------------------------- */}
          {data.expiringCodes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Codes expiring soon</CardTitle>
                <AlertTriangle className="size-4 text-warn-600" aria-hidden />
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.expiringCodes.map((code) => (
                    <li key={code.id} className="px-5 py-3">
                      <p className="text-sm font-semibold text-[var(--text-strong)]">
                        {code.student.fullName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {code.schoolClass?.name ?? 'No class'} · expires{' '}
                        {formatDate(code.expiresAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* --- Pending tasks -------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Administrator tasks</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/manage/tasks">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.pendingTasks.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                  Nothing outstanding.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.pendingTasks.map((task) => (
                    <li key={task.id} className="px-5 py-3">
                      <Link
                        href={`/manage/tasks?highlight=${task.id}`}
                        className="block"
                      >
                        <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                          {task.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {task.assignedTo.fullName} ·{' '}
                          {TASK_PRIORITY_LABELS[
                            task.priority as keyof typeof TASK_PRIORITY_LABELS
                          ] ?? task.priority}
                          {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Quick links ---------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <QuickLink
                href="/manage/students"
                icon={<GraduationCap className="size-4" aria-hidden />}
                label="Students"
              />
              <QuickLink
                href="/manage/admins"
                icon={<ShieldCheck className="size-4" aria-hidden />}
                label="Admins"
              />
              <QuickLink
                href="/manage/classes"
                icon={<Users className="size-4" aria-hidden />}
                label="Classes"
              />
              <QuickLink
                href="/manage/subjects"
                icon={<Layers className="size-4" aria-hidden />}
                label="Subjects"
              />
              <QuickLink
                href="/manage/materials"
                icon={<BookOpen className="size-4" aria-hidden />}
                label="Materials"
              />
              <QuickLink
                href="/manage/settings"
                icon={<ShieldCheck className="size-4" aria-hidden />}
                label="Settings"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warn' | 'danger';
}) {
  const tones = {
    success: 'bg-success-50 text-success-700 dark:bg-success-700/15 dark:text-success-500',
    warn: 'bg-warn-50 text-warn-700 dark:bg-warn-700/15 dark:text-warn-500',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-700/15 dark:text-danger-500',
  };

  return (
    <div className={`rounded-[var(--radius-field)] px-2 py-2.5 ${tones[tone]}`}>
      <dd className="font-display text-lg font-extrabold tabular-nums">{value}</dd>
      <dt className="text-[0.6875rem] font-medium">{label}</dt>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-[var(--radius-field)] border border-[var(--line-soft)] px-3 py-2.5 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-brand-300 hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
    >
      <span className="text-brand-600" aria-hidden>
        {icon}
      </span>
      {label}
    </Link>
  );
}
