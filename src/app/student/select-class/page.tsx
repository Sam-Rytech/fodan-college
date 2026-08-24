import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { prisma } from '@/lib/db';
import { guardStudent } from '@/lib/auth/guards';
import { STUDENT_TYPES } from '@/lib/constants';
import { SelectClassForm } from './select-class-form';

export const metadata: Metadata = { title: 'Choose your class' };

export default async function SelectClassPage() {
  const user = await guardStudent();

  // Once activated the class is fixed, so there is nothing to do here.
  if (user.student?.isActivated && user.student.classId) {
    redirect('/student');
  }

  const classes = await prisma.schoolClass.findMany({
    where: { isActive: true },
    orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
    select: {
      id: true,
      name: true,
      level: true,
      description: true,
      _count: { select: { subjects: true } },
    },
  });

  const primary = classes.filter((item) => item.level === STUDENT_TYPES.PRIMARY);
  const secondary = classes.filter((item) => item.level === STUDENT_TYPES.SECONDARY);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Which class are you in?"
        description="Your class decides which subjects, lessons and examinations you see. Choose carefully — after activation only a teacher can change it."
      />

      {classes.length === 0 ? (
        <Alert tone="warn" title="No classes are set up yet">
          The school has not created any classes. Please tell your teacher or the
          school office.
        </Alert>
      ) : (
        <SelectClassForm
          primary={primary}
          secondary={secondary}
          currentClassId={user.student?.classId ?? null}
        />
      )}
    </div>
  );
}
