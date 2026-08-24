import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { AdminSettingsForm } from './admin-settings-form';

export const metadata: Metadata = { title: 'Manage Administrator' };

export default async function ManageAdminSettingsPage({
  params,
}: {
  params: Promise<{ adminId: string }>;
}) {
  const { adminId } = await params;
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_ADMINS);

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    include: {
      permissions: { select: { permission: true } },
      classAssignments: { select: { classId: true } },
      subjectAssignments: { select: { subjectId: true } },
    }
  });

  if (!admin) notFound();

  const permissions = await prisma.permission.findMany({ orderBy: { category: 'asc' } });
  const classes = await prisma.schoolClass.findMany({ orderBy: { orderIndex: 'asc' } });
  const subjects = await prisma.subject.findMany({ orderBy: { orderIndex: 'asc' } });

  const assignedPermissions = admin.permissions.map(p => p.permission.key);
  const assignedClasses = admin.classAssignments.map(c => c.classId);
  const assignedSubjects = admin.subjectAssignments.map(s => s.subjectId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Manage Administrator Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Modify the scopes and capabilities for {admin.fullName}.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <AdminSettingsForm 
          adminId={adminId}
          permissions={permissions} 
          classes={classes} 
          subjects={subjects} 
          assignedPermissions={assignedPermissions}
          assignedClasses={assignedClasses}
          assignedSubjects={assignedSubjects}
        />
      </div>
    </div>
  );
}
