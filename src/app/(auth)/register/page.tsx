import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/feedback';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathFor } from '@/lib/auth/guards';
import { getBooleanSetting } from '@/lib/settings';
import { SETTING_KEYS } from '@/lib/constants';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Create your account' };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));

  const [allowRegistration, classes] = await Promise.all([
    getBooleanSetting(SETTING_KEYS.ALLOW_REGISTRATION),
    prisma.schoolClass.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
      select: { id: true, name: true, level: true },
    }),
  ]);

  if (!allowRegistration) {
    return (
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Registration is closed
        </h1>
        <Alert tone="info" className="mt-5">
          The school is not accepting new registrations at the moment. Please ask
          your class teacher or the school office to create your account.
        </Alert>
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          It takes a minute. Your school will then send you an activation code to
          open your lessons.
        </p>
      </header>

      <RegisterForm classes={classes} />

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
