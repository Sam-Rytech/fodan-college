'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/lib/actions';
import { forgotPasswordAction } from '../actions';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ devToken?: string }> | null,
    FormData
  >(forgotPasswordAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Request received">
          {state.message}
        </Alert>

        {state.data.devToken ? (
          // Development only. With MAIL_DRIVER unset there is no transport, so
          // the link is surfaced here (and in the server log) instead of being
          // silently dropped.
          <Alert tone="warn" title="Development mode">
            <p>No mail transport is configured, so here is the reset link:</p>
            <Link
              href={`/reset-password?token=${state.data.devToken}`}
              className="mt-2 block break-all font-mono text-xs font-semibold underline"
            >
              /reset-password?token={state.data.devToken}
            </Link>
          </Alert>
        ) : null}

        <Button asChild variant="secondary" block>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {failed ? <Alert tone="danger">{failed.error}</Alert> : null}

      <Field
        label="Username, email or phone"
        error={failed?.fieldErrors?.identifier}
        required
      >
        <Input
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          placeholder="e.g. chidinma.eze"
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        block
        loading={pending}
        loadingLabel="Preparing your link…"
        iconLeft={<Send className="size-4" aria-hidden />}
      >
        Send reset link
      </Button>
    </form>
  );
}
