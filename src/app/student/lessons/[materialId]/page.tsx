import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { Breadcrumb } from '@/components/ui/misc';
import { MaterialIcon } from '@/components/student/subject-icon';
import { MaterialViewer } from '@/components/student/material-viewer';
import { CompleteLessonButton } from './complete-button';
import { guardLearningAccess } from '@/lib/auth/guards';
import { getMaterialForStudent } from '@/lib/data/student';
import { isAppError } from '@/lib/errors';
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/constants';
import { RichText } from '@/components/forum/rich-text';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ materialId: string }>;
}): Promise<Metadata> {
  const { materialId } = await params;
  const user = await guardLearningAccess().catch(() => null);
  if (!user) return { title: 'Lesson' };

  const detail = await getMaterialForStudent(user, materialId).catch(() => null);
  return { title: detail?.material.title ?? 'Lesson' };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const user = await guardLearningAccess();
  const { materialId } = await params;

  const detail = await getMaterialForStudent(user, materialId).catch((error) => {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  const { material, progress, siblings, previous, next } = detail;
  const completed = progress?.status === 'COMPLETED';

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Subjects', href: '/student/subjects' },
              {
                label: material.subject.name,
                href: `/student/subjects/${material.subject.slug}`,
              },
              { label: material.topic.title },
            ]}
          />
        }
        title={
          <span className="flex items-center gap-3">
            <MaterialIcon type={material.type} />
            <span className="min-w-0">{material.title}</span>
          </span>
        }
        actions={
          completed ? (
            <Badge tone="success" dot>
              Completed
            </Badge>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <MaterialViewer
            materialId={material.id}
            type={material.type}
            fileId={material.fileId}
            fileName={material.file.originalName}
            fileSize={material.file.sizeBytes}
            title={material.title}
            downloadable={material.downloadable}
            initialPositionSeconds={progress?.lastPositionSeconds ?? 0}
          />

          {material.description ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">About this lesson</CardTitle>
              </CardHeader>
              <CardContent>
                <RichText text={material.description} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  {completed ? 'You have finished this lesson' : 'Finished this lesson?'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {completed
                    ? 'It counts towards your subject progress.'
                    : 'Mark it complete to move your progress forward.'}
                </p>
              </div>
              <CompleteLessonButton
                materialId={material.id}
                completed={completed}
                nextHref={next ? `/student/lessons/${next.id}` : null}
              />
            </CardContent>
          </Card>

          {/* Previous / next within the topic */}
          <nav
            className="flex flex-wrap items-center justify-between gap-3"
            aria-label="Lesson navigation"
          >
            {previous ? (
              <Button asChild variant="secondary">
                <Link href={`/student/lessons/${previous.id}`}>
                  <ChevronLeft className="size-4" aria-hidden />
                  <span className="max-w-40 truncate">{previous.title}</span>
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button asChild>
                <Link href={`/student/lessons/${next.id}`}>
                  <span className="max-w-40 truncate">{next.title}</span>
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href={`/student/subjects/${material.subject.slug}`}>
                  Back to {material.subject.name}
                </Link>
              </Button>
            )}
          </nav>
        </div>

        {/* --- Topic contents ---------------------------------------- */}
        <aside>
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle as="h2" className="text-sm">
                {material.topic.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-[var(--line-soft)]">
                {siblings.map((item, index) => {
                  const active = item.id === material.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/student/lessons/${item.id}`}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                          active
                            ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200'
                            : 'text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                        }`}
                      >
                        <span
                          className="w-4 shrink-0 text-xs tabular-nums text-[var(--text-muted)]"
                          aria-hidden
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        <span className="sr-only">
                          {MATERIAL_TYPE_LABELS[item.type as MaterialType] ?? item.type}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
