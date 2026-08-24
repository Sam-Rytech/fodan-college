import { type Metadata } from 'next';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { GenerateCodesForm } from './generate-codes-form';

export const metadata: Metadata = { title: 'Generate Access Codes' };

export default async function GenerateCodesPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_STUDENTS);

  // Fetch inactive students (who don't have active codes, or are not activated yet)
  const students = await prisma.user.findMany({
    where: { 
      role: { key: 'STUDENT' },
      studentProfile: { isActivated: false }
    },
    include: {
      studentProfile: { include: { schoolClass: true } }
    },
    orderBy: { fullName: 'asc' }
  });

  const classes = await prisma.schoolClass.findMany({ orderBy: { orderIndex: 'asc' } });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Generate Access Codes
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Create activation codes for students so they can access their learning materials.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <GenerateCodesForm students={students} classes={classes} />
      </div>
    </div>
  );
}
