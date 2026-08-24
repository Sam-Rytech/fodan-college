import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/feedback';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathFor } from '@/lib/auth/guards';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; expired?: string }>;
}) {
  // Someone already signed in has no business on the sign-in screen.
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));

  const params = await searchParams;

  // Only same-site relative paths survive; anything else is dropped so the
  // sign-in form cannot be used as an open redirect.
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : undefined;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          Sign in with your username, email address or phone number.
        </p>
      </header>

      {params.reset === 'done' ? (
        <Alert tone="success" className="mb-5">
          Your password has been changed. Sign in with your new password.
        </Alert>
      ) : null}

      {params.expired === '1' ? (
        <Alert tone="warn" className="mb-5">
          You were signed out because the session had been idle. Please sign in
          again.
        </Alert>
      ) : null}

      <LoginForm next={next} />

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        New student?{' '}
        <Link
          href="/register"
          className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
