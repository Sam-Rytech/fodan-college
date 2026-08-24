import { type Metadata } from 'next';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { AdminForm } from './admin-form';

export const metadata: Metadata = { title: 'Create Administrator' };

export default async function CreateAdminPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_ADMINS);

  const permissions = await prisma.permission.findMany({ orderBy: { category: 'asc' } });
  const classes = await prisma.schoolClass.findMany({ orderBy: { orderIndex: 'asc' } });
  const subjects = await prisma.subject.findMany({ orderBy: { orderIndex: 'asc' } });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Create Administrator
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Add a new Mini Admin staff member and define their access.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <AdminForm permissions={permissions} classes={classes} subjects={subjects} />
      </div>
    </div>
  );
}
