import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { getStudentDetail } from '@/lib/data/admin';
import { StudentForm } from './student-form';

export const metadata: Metadata = { title: 'Student Details' };

export default async function ManageStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_STUDENTS);

  const isNew = studentId === 'new';
  let studentData = null;

  if (!isNew) {
    const detail = await getStudentDetail(user, studentId);
    if (!detail) notFound();
    studentData = detail.profile;
  }

  // Fetch classes for the dropdown
  const classes = await prisma.schoolClass.findMany({
    orderBy: { orderIndex: 'asc' },
    select: { id: true, name: true, level: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          {isNew ? 'Register Student' : 'Edit Student'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isNew
            ? 'Create a new student account.'
            : 'Update the details for this student.'}
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <StudentForm initialData={studentData} classes={classes} />
      </div>
    </div>
  );
}
