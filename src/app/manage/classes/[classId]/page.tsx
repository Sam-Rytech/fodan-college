import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { ClassForm } from './class-form';

export const metadata: Metadata = { title: 'Class Details' };

export default async function ManageClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_CLASSES);

  const isNew = classId === 'new';
  const classData = isNew
    ? null
    : await prisma.schoolClass.findUnique({
        where: { id: classId },
      });

  if (!isNew && !classData) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          {isNew ? 'Create Class' : 'Edit Class'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isNew
            ? 'Add a new academic class to the school.'
            : 'Update the details for this class.'}
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <ClassForm initialData={classData} />
      </div>
    </div>
  );
}
