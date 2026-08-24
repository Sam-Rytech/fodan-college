'use client';

import { useActionState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { PasswordInput } from '@/components/ui/password-input';
import type { PasswordContext } from '@/lib/password-policy';
import type { ActionResult } from '@/lib/actions';
import { changePasswordAction } from '../(auth)/actions';

export function ChangePasswordForm({ context }: { context: PasswordContext }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(changePasswordAction, null);

  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {failed ? <Alert tone="danger">{failed.error}</Alert> : null}

      <Field
        label="Current password"
        error={failed?.fieldErrors?.currentPassword}
        required
      >
        <PasswordInput
          name="currentPassword"
          autoComplete="current-password"
          required
          autoFocus
        />
      </Field>

      <Field label="New password" error={failed?.fieldErrors?.newPassword} required>
        <PasswordInput
          name="newPassword"
          autoComplete="new-password"
          required
          showMeter
          context={context}
        />
      </Field>

      <Field
        label="Confirm new password"
        error={failed?.fieldErrors?.confirmPassword}
        required
      >
        <PasswordInput name="confirmPassword" autoComplete="new-password" required />
      </Field>

      <Button
        type="submit"
        size="lg"
        block
        loading={pending}
        loadingLabel="Saving…"
        iconLeft={<KeyRound className="size-4" aria-hidden />}
      >
        Save new password
      </Button>
    </form>
  );
}
