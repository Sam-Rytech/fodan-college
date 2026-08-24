import { type Metadata } from 'next';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';
import { ROLES } from '@/lib/constants';
import { TaskForm } from './task-form';

export const metadata: Metadata = { title: 'Create Task' };

export default async function CreateTaskPage() {
  await guardStaff(); // Anyone on staff can create a task

  const staff = await prisma.user.findMany({
    where: { role: { key: { in: [ROLES.MINI_ADMIN, ROLES.SUPER_ADMIN] } }, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Create Task
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Assign administrative duties to staff members.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <TaskForm staff={staff} />
      </div>
    </div>
  );
}
