'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { PasswordInput } from '@/components/ui/password-input';
import type { ActionResult } from '@/lib/actions';
import { resetPasswordAction } from '../actions';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(resetPasswordAction, null);

  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {failed ? (
        <Alert tone="danger">
          {failed.error}
          {failed.code === 'VALIDATION' && failed.fieldErrors === undefined ? (
            <Link
              href="/forgot-password"
              className="mt-2 block font-semibold underline"
            >
              Request a new link
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <Field label="New password" error={failed?.fieldErrors?.newPassword} required>
        <PasswordInput
          name="newPassword"
          autoComplete="new-password"
          required
          autoFocus
          showMeter
          placeholder="At least 8 characters"
        />
      </Field>

      <Field
        label="Confirm new password"
        error={failed?.fieldErrors?.confirmPassword}
        required
      >
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          required
          placeholder="Type it once more"
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        block
        loading={pending}
        loadingLabel="Saving your new password…"
        iconLeft={<KeyRound className="size-4" aria-hidden />}
      >
        Save new password
      </Button>
    </form>
  );
}
