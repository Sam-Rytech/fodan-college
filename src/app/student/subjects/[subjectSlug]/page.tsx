import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, Layers, PlayCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Badge, EmptyState, Progress } from '@/components/ui/feedback';
import { Breadcrumb } from '@/components/ui/misc';
import { MaterialIcon, SubjectIcon } from '@/components/student/subject-icon';
import { guardLearningAccess } from '@/lib/auth/guards';
import { getSubjectDetail } from '@/lib/data/student';
import { isAppError } from '@/lib/errors';
import { MATERIAL_TYPE_LABELS, type MaterialType } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subjectSlug: string }>;
}): Promise<Metadata> {
  const { subjectSlug } = await params;
  const pretty = subjectSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return { title: pretty };
}

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ subjectSlug: string }>;
}) {
  const user = await guardLearningAccess();
  const { subjectSlug } = await params;

  const detail = await getSubjectDetail(user, subjectSlug).catch((error) => {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  });

  const { subject, topics } = detail;

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Subjects', href: '/student/subjects' },
              { label: subject.name },
            ]}
          />
        }
        title={
          <span className="flex items-center gap-3">
            <SubjectIcon iconKey={subject.iconKey} colorKey={subject.colorKey} />
            {subject.name}
          </span>
        }
        description={subject.description}
      />

      <Card className="mb-6 p-5">
        <Progress
          value={detail.progressPercent}
          label={`${detail.totalCompleted} of ${detail.totalMaterials} lessons completed`}
          showValue
          size="lg"
          tone={detail.progressPercent === 100 ? 'success' : 'brand'}
        />
      </Card>

      {topics.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" aria-hidden />}
          title="No topics yet"
          description="Your teacher has not published any topics for this subject. Check back soon."
        />
      ) : (
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <Card key={topic.id}>
              <CardHeader>
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-sunken)] font-display text-sm font-bold text-[var(--text-muted)]"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <CardTitle as="h2">{topic.title}</CardTitle>
                    {topic.description ? (
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                        {topic.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                {topic.materials.length > 0 ? (
                  <Badge
                    tone={
                      topic.completedCount === topic.materials.length
                        ? 'success'
                        : 'neutral'
                    }
                    dot
                  >
                    {topic.completedCount}/{topic.materials.length} done
                  </Badge>
                ) : null}
              </CardHeader>

              <CardContent className="p-0">
                {topic.materials.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">
                    No lessons have been published for this topic yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--line-soft)]">
                    {topic.materials.map((material) => {
                      const done = material.progress?.status === 'COMPLETED';
                      const started =
                        !done && (material.progress?.progressPercent ?? 0) > 0;

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
                                <span>
                                  {MATERIAL_TYPE_LABELS[
                                    material.type as MaterialType
                                  ] ?? material.type}
                                </span>
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
                              <CheckCircle2
                                className="size-5 shrink-0 text-success-600"
                                aria-label="Completed"
                              />
                            ) : started ? (
                              <span className="hidden w-20 shrink-0 sm:block">
                                <Progress
                                  value={material.progress?.progressPercent ?? 0}
                                  size="sm"
                                />
                              </span>
                            ) : (
                              <PlayCircle
                                className="size-5 shrink-0 text-[var(--text-muted)]"
                                aria-hidden
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
