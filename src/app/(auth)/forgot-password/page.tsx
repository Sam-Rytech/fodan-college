import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Forgotten password' };

export default function ForgotPasswordPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Forgotten your password?
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          Tell us your username, email address or phone number and we will
          prepare a reset link.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
