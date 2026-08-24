import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { LogoLockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme';
import { Alert } from '@/components/ui/feedback';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'Change your password' };

/**
 * Deliberately outside the application shell.
 *
 * When `mustChangePassword` is set, every guarded page redirects here, so this
 * screen must not depend on the shell — and it must not offer navigation that
 * would let the requirement be skipped. The only way out is to set a password
 * or sign out.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/change-password');

  const forced = user.mustChangePassword;

  return (
    <div className="brand-wash flex min-h-dvh flex-col bg-[var(--surface-page)]">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <LogoLockup size="sm" href={forced ? '/change-password' : '/'} showMotto />
        <ThemeToggle />
      </header>

      <main
        id="main"
        className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8"
      >
        <div className="w-full max-w-md animate-fade-up">
          <header className="mb-6">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              {forced ? 'Set a new password' : 'Change your password'}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              Signed in as <span className="font-semibold">{user.fullName}</span>{' '}
              (@{user.username}).
            </p>
          </header>

          {forced ? (
            <Alert
              tone="warn"
              title="A new password is required"
              className="mb-5"
            >
              This account is still using a temporary password. Choose your own
              before you continue.
            </Alert>
          ) : null}

          <Card>
            <CardContent className="py-5">
              <ChangePasswordForm
                context={{
                  username: user.username,
                  fullName: user.fullName,
                  email: user.email,
                }}
              />
            </CardContent>
          </Card>

          <p className="mt-5 flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <ShieldAlert className="mt-px size-4 shrink-0" aria-hidden />
            <span>
              Changing your password signs you out of every other device. Nobody
              at the school — not even the Super Admin — can read your password.
            </span>
          </p>

          <form action="/api/auth/logout" method="post" className="mt-4 text-center">
            <button
              type="submit"
              className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 hover:underline"
            >
              Sign out instead
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
