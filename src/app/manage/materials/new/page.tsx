import { type Metadata } from 'next';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { MaterialForm } from './material-form';
import { classScopeFilter, subjectScopeFilter } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'Upload Material' };

export default async function UploadMaterialPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_MATERIALS);

  const classScope = classScopeFilter(user);
  const subjectScope = subjectScopeFilter(user);

  // We need topics, and the frontend needs to map them to subjects/classes
  const topics = await prisma.topic.findMany({
    where: {
      ...classScope,
      ...subjectScope,
    },
    include: {
      schoolClass: true,
      subject: true,
    },
    orderBy: [
      { classId: 'asc' },
      { subjectId: 'asc' },
      { orderIndex: 'asc' }
    ]
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Upload Material
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Add new learning content to a topic.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <MaterialForm topics={topics} />
      </div>
    </div>
  );
}
