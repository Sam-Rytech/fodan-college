import Link from 'next/link';
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  Upload,
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
import { Alert, Badge, EmptyState } from '@/components/ui/feedback';
import { SubjectIcon } from '@/components/student/subject-icon';
import { getMiniAdminDashboard } from '@/lib/data/admin';
import { hasPermission } from '@/lib/auth/rbac';
import {
  PERMISSIONS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants';
import { formatDate, formatPercent, formatRelative, isPast } from '@/lib/utils';
import type { AuthUser } from '@/lib/auth/types';

type DashboardData = Awaited<ReturnType<typeof getMiniAdminDashboard>>;

/**
 * The Mini Admin workspace.
 *
 * Scoped by construction: only assigned classes and subjects appear, and no
 * panel shows another administrator's private information. An admin with no
 * assignment sees a clear explanation rather than an empty grid.
 */
export function MiniAdminDashboard({
  data,
  user,
}: {
  data: DashboardData;
  user: AuthUser;
}) {
  const unassigned = data.classes.length === 0 && data.subjects.length === 0;
  const overdue = data.tasks.filter(
    (task) => task.dueDate && isPast(task.dueDate),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.fullName.split(' ')[0]}`}
        description="Your assigned classes, subjects and tasks."
        actions={
          hasPermission(user, PERMISSIONS.UPLOAD_MATERIALS) ? (
            <Button asChild>
              <Link href="/manage/materials/new">
                <Upload className="size-4" aria-hidden />
                Upload material
              </Link>
            </Button>
          ) : null
        }
      />

      {unassigned ? (
        <Alert tone="info" title="You have not been assigned any classes yet">
          The Super Admin decides which classes and subjects you look after. Until
          then, most sections will be empty. Your task list below still works.
        </Alert>
      ) : null}

      {overdue > 0 ? (
        <Alert
          tone="warn"
          title={`${overdue} task${overdue === 1 ? ' is' : 's are'} past the due date`}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href="/manage/tasks">Open my tasks</Link>
            </Button>
          }
        >
          Update the status so the Super Admin can see where things stand.
        </Alert>
      ) : null}

      <section className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending tasks"
          value={data.taskCounts.pending + data.taskCounts.inProgress}
          hint={`${data.taskCounts.completed} completed so far`}
          icon={<ClipboardList className="size-5" aria-hidden />}
          tone={data.taskCounts.pending > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="Students in my classes"
          value={data.studentCount}
          hint={`${data.classes.length} class${data.classes.length === 1 ? '' : 'es'} assigned`}
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <StatCard
          label="Materials I uploaded"
          value={data.materialsUploaded}
          icon={<BookOpen className="size-5" aria-hidden />}
          tone="success"
        />
        <StatCard
          label="Examinations I created"
          value={data.examsManaged}
          icon={<FileText className="size-5" aria-hidden />}
          tone="brand"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* --- Tasks ---------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>My tasks</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/manage/tasks">All tasks</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.tasks.length === 0 ? (
                <EmptyState
                  icon={<CheckSquare className="size-6" aria-hidden />}
                  title="Nothing assigned right now"
                  description="When the Super Admin assigns you a task it will appear here."
                  className="m-5 border-0"
                />
              ) : (
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.tasks.map((task) => {
                    const late = task.dueDate && isPast(task.dueDate);
                    return (
                      <li key={task.id} className="px-5 py-4">
                        <Link href={`/manage/tasks?highlight=${task.id}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 text-sm font-bold text-[var(--text-strong)]">
                              {task.title}
                            </p>
                            <div className="flex shrink-0 gap-1.5">
                              <Badge
                                tone={
                                  task.priority === 'URGENT'
                                    ? 'danger'
                                    : task.priority === 'HIGH'
                                      ? 'warn'
                                      : 'neutral'
                                }
                              >
                                {TASK_PRIORITY_LABELS[task.priority as TaskPriority] ??
                                  task.priority}
                              </Badge>
                              <Badge
                                tone={task.status === 'IN_PROGRESS' ? 'brand' : 'neutral'}
                                dot
                              >
                                {TASK_STATUS_LABELS[task.status as TaskStatus] ??
                                  task.status}
                              </Badge>
                            </div>
                          </div>
                          {task.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                              {task.description}
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                            Assigned by {task.createdBy?.fullName ?? 'the school'}
                            {task.dueDate ? (
                              <>
                                {' · '}
                                <span
                                  className={
                                    late
                                      ? 'font-semibold text-danger-600'
                                      : undefined
                                  }
                                >
                                  due {formatDate(task.dueDate)}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Recent uploads --------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Materials you uploaded</CardTitle>
              {hasPermission(user, PERMISSIONS.UPLOAD_MATERIALS) ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/manage/materials">Manage</Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              {data.recentMaterials.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                  You have not uploaded anything yet.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.recentMaterials.map((material) => (
                    <li
                      key={material.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                          {material.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {material.subject.name} · {material.schoolClass.name} ·{' '}
                          {formatRelative(material.createdAt)}
                        </p>
                      </div>
                      <Badge
                        tone={material.status === 'PUBLISHED' ? 'success' : 'neutral'}
                        dot
                      >
                        {material.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* --- Assigned classes ----------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>My classes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.classes.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                  No classes assigned.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)]">
                  {data.classes.map((schoolClass) => (
                    <li
                      key={schoolClass.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-strong)]">
                          {schoolClass.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {schoolClass._count.students} student
                          {schoolClass._count.students === 1 ? '' : 's'} ·{' '}
                          {schoolClass._count.materials} material
                          {schoolClass._count.materials === 1 ? '' : 's'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Assigned subjects ---------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>My subjects</CardTitle>
            </CardHeader>
            <CardContent>
              {data.subjects.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                  No subjects assigned.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.subjects.map((subject) => (
                    <li key={subject.id} className="flex items-center gap-3">
                      <SubjectIcon
                        iconKey={subject.iconKey}
                        colorKey={subject.colorKey}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-[var(--text-strong)]">
                        {subject.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* --- Recent results in my classes ----------------------- */}
          {hasPermission(user, PERMISSIONS.VIEW_RESULTS) ? (
            <Card>
              <CardHeader>
                <CardTitle>Latest results</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/manage/results">All</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {data.recentResults.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                    No submissions yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--line-soft)]">
                    {data.recentResults.map((result) => (
                      <li key={result.id} className="px-5 py-3">
                        <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                          {result.student.fullName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {result.exam.title} · {formatPercent(result.percentage)} ·{' '}
                          {formatRelative(result.submittedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>What you can do</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {user.permissions.length === 0 ? (
                  <li className="text-[var(--text-muted)]">
                    No permissions have been granted yet.
                  </li>
                ) : (
                  user.permissions.map((permission) => (
                    <li
                      key={permission}
                      className="flex items-center gap-2 text-[var(--text-body)]"
                    >
                      <Layers className="size-3.5 text-brand-600" aria-hidden />
                      <span className="font-mono text-xs">{permission}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
