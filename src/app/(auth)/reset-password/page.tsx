import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          This link is incomplete
        </h1>
        <Alert tone="warn" className="mt-5">
          The reset link is missing its token. Request a new one and use the
          whole link exactly as it was sent to you.
        </Alert>
        <Button asChild variant="secondary" block className="mt-5">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          Pick something you have not used before. Everything else signed in as
          you will be signed out.
        </p>
      </header>

      {/* The token is never validated here — only on submit. Checking it on
          render would let anyone probe which tokens exist. */}
      <ResetPasswordForm token={token} />
    </div>
  );
}
