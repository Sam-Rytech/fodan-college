import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileText, Layers } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui/card';
import { Badge, EmptyState, Progress } from '@/components/ui/feedback';
import { SubjectIcon } from '@/components/student/subject-icon';
import { guardLearningAccess } from '@/lib/auth/guards';
import { getStudentSubjects } from '@/lib/data/student';
import { formatPercent } from '@/lib/utils';

export const metadata: Metadata = { title: 'Subjects' };

export default async function SubjectsPage() {
  const user = await guardLearningAccess('/student/subjects');
  const subjects = await getStudentSubjects(user);

  return (
    <div>
      <PageHeader
        title="Your subjects"
        description={`Everything prepared for ${user.student?.className ?? 'your class'}. Open a subject to see its topics and lessons.`}
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" aria-hidden />}
          title="No subjects yet"
          description="Your class does not have any subjects assigned. Please tell your class teacher."
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <Card key={subject.id} interactive className="overflow-hidden">
              <Link
                href={`/student/subjects/${subject.slug}`}
                className="flex h-full flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <SubjectIcon
                    iconKey={subject.iconKey}
                    colorKey={subject.colorKey}
                    size="lg"
                  />
                  {subject.examCount > 0 ? (
                    <Badge tone="warn">
                      <FileText className="size-3" aria-hidden />
                      {subject.examCount} exam
                      {subject.examCount === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                </div>

                <h2 className="mt-4 text-base font-bold text-[var(--text-strong)]">
                  {subject.name}
                </h2>
                {subject.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                    {subject.description}
                  </p>
                ) : null}

                <dl className="mt-4 flex gap-5 text-xs text-[var(--text-muted)]">
                  <div>
                    <dt className="sr-only">Topics</dt>
                    <dd>
                      <span className="font-bold text-[var(--text-strong)]">
                        {subject.topicCount}
                      </span>{' '}
                      topic{subject.topicCount === 1 ? '' : 's'}
                    </dd>
                  </div>
                  <div>
                    <dt className="sr-only">Lessons</dt>
                    <dd>
                      <span className="font-bold text-[var(--text-strong)]">
                        {subject.materialCount}
                      </span>{' '}
                      lesson{subject.materialCount === 1 ? '' : 's'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto pt-5">
                  <Progress
                    value={subject.progressPercent}
                    label={`${subject.completedCount} of ${subject.materialCount} done`}
                    showValue
                    tone={subject.progressPercent === 100 ? 'success' : 'brand'}
                  />
                  <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300">
                    {subject.progressPercent === 0
                      ? 'Start learning'
                      : subject.progressPercent === 100
                        ? 'Revise this subject'
                        : `Continue · ${formatPercent(subject.progressPercent, 0)}`}
                    <ArrowRight className="size-4" aria-hidden />
                  </p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
