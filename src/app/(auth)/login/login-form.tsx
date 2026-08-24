'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AtSign, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { PasswordInput } from '@/components/ui/password-input';
import type { ActionResult } from '@/lib/actions';
import { loginAction } from '../actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(loginAction, null);

  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {failed ? (
        <Alert tone={failed.code === 'ACCOUNT_LOCKED' ? 'warn' : 'danger'}>
          {failed.error}
          {failed.reference ? (
            <span className="mt-1 block text-xs opacity-80">
              Reference {failed.reference}
            </span>
          ) : null}
        </Alert>
      ) : null}

      <Field
        label="Username, email or phone"
        error={failed?.fieldErrors?.identifier}
        required
      >
        <Input
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          placeholder="e.g. chidinma.eze"
          iconLeft={<AtSign className="size-4" aria-hidden />}
        />
      </Field>

      <Field label="Password" error={failed?.fieldErrors?.password} required>
        <PasswordInput
          name="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          Forgotten your password?
        </Link>
      </div>

      <Button
        type="submit"
        size="lg"
        block
        loading={pending}
        loadingLabel="Signing you in…"
        iconLeft={<LogIn className="size-4" aria-hidden />}
      >
        Sign in
      </Button>
    </form>
  );
}
