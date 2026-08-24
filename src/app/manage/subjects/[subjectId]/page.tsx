import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { SubjectForm } from './subject-form';

export const metadata: Metadata = { title: 'Subject Details' };

export default async function ManageSubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_SUBJECTS);

  const isNew = subjectId === 'new';
  const subjectData = isNew
    ? null
    : await prisma.subject.findUnique({
        where: { id: subjectId },
        include: { classes: true },
      });

  if (!isNew && !subjectData) {
    notFound();
  }

  // Fetch all classes so the admin can assign this subject to specific classes
  const classes = await prisma.schoolClass.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          {isNew ? 'Create Subject' : 'Edit Subject'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isNew
            ? 'Add a new academic subject.'
            : 'Update the details for this subject.'}
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <SubjectForm initialData={subjectData} availableClasses={classes} />
      </div>
    </div>
  );
}
