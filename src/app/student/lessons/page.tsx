import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Badge, EmptyState, Progress } from '@/components/ui/feedback';
import { LinkTabs } from '@/components/ui/misc';
import { MaterialIcon } from '@/components/student/subject-icon';
import { guardLearningAccess } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { LESSON_PROGRESS_STATUS, PUBLISH_STATUS } from '@/lib/constants';
import { formatDuration, formatRelative } from '@/lib/utils';

export const metadata: Metadata = { title: 'Lessons' };

/**
 * A flat view of every lesson in the student's class, filterable by state.
 * The subjects page is for browsing by structure; this one answers "what have
 * I not finished?" without clicking through four subjects.
 */
export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await guardLearningAccess('/student/lessons');
  const { filter } = await searchParams;
  const classId = user.student?.classId ?? '';

  const [materials, progressRows] = await Promise.all([
    prisma.learningMaterial.findMany({
      where: { classId, status: PUBLISH_STATUS.PUBLISHED },
      orderBy: [{ subject: { orderIndex: 'asc' } }, { topic: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
      include: {
        subject: { select: { name: true, slug: true } },
        topic: { select: { title: true } },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { studentId: user.id },
      select: {
        materialId: true,
        status: true,
        progressPercent: true,
        updatedAt: true,
      },
    }),
  ]);

  const progressMap = new Map(progressRows.map((row) => [row.materialId, row]));

  const withProgress = materials.map((material) => ({
    ...material,
    progress: progressMap.get(material.id) ?? null,
  }));

  const completed = withProgress.filter(
    (item) => item.progress?.status === LESSON_PROGRESS_STATUS.COMPLETED,
  );
  const inProgress = withProgress.filter(
    (item) =>
      item.progress &&
      item.progress.status !== LESSON_PROGRESS_STATUS.COMPLETED,
  );
  const notStarted = withProgress.filter((item) => !item.progress);

  const active = filter === 'completed' || filter === 'in-progress' || filter === 'not-started'
    ? filter
    : 'all';

  const shown =
    active === 'completed'
      ? completed
      : active === 'in-progress'
        ? inProgress
        : active === 'not-started'
          ? notStarted
          : withProgress;

  return (
    <div>
      <PageHeader
        title="All lessons"
        description={`Every lesson published for ${user.student?.className ?? 'your class'}.`}
      />

      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle className="sr-only">Filter lessons</CardTitle>
        </CardHeader>
        <div className="px-5">
          <LinkTabs
            current={active === 'all' ? '/student/lessons' : `/student/lessons?filter=${active}`}
            items={[
              { href: '/student/lessons', label: `All (${withProgress.length})` },
              {
                href: '/student/lessons?filter=in-progress',
                label: `In progress (${inProgress.length})`,
              },
              {
                href: '/student/lessons?filter=not-started',
                label: `Not started (${notStarted.length})`,
              },
              {
                href: '/student/lessons?filter=completed',
                label: `Completed (${completed.length})`,
              },
            ]}
          />
        </div>

        <CardContent className="p-0">
          {shown.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-6" aria-hidden />}
              title={
                active === 'completed'
                  ? 'Nothing completed yet'
                  : active === 'in-progress'
                    ? 'Nothing in progress'
                    : 'No lessons here'
              }
              description="Open a subject and start with the first topic."
              action={
                <Button asChild>
                  <Link href="/student/subjects">Browse subjects</Link>
                </Button>
              }
              className="m-5 border-0"
            />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {shown.map((material) => {
                const done =
                  material.progress?.status === LESSON_PROGRESS_STATUS.COMPLETED;

                return (
                  <li key={material.id}>
                    <Link
                      href={`/student/lessons/${material.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-sunken)]"
                    >
                      <MaterialIcon type={material.type} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text-strong)]">
                          {material.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                          <span>{material.subject.name}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate">{material.topic.title}</span>
                          {material.durationSeconds ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" aria-hidden />
                                {formatDuration(material.durationSeconds)}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </span>

                      {done ? (
                        <Badge tone="success" dot className="hidden sm:inline-flex">
                          Done
                        </Badge>
                      ) : material.progress ? (
                        <span className="hidden w-24 shrink-0 sm:block">
                          <Progress
                            value={material.progress.progressPercent}
                            size="sm"
                          />
                          <span className="mt-1 block text-right text-[0.625rem] text-[var(--text-muted)]">
                            {formatRelative(material.progress.updatedAt)}
                          </span>
                        </span>
                      ) : null}

                      {done ? (
                        <CheckCircle2
                          className="size-5 shrink-0 text-success-600 sm:hidden"
                          aria-label="Completed"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
