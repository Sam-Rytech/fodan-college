'use client';

import { useActionState, useState } from 'react';
import { Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/lib/actions';
import { activateAction } from '../actions';

/**
 * Activation code entry.
 *
 * The field upper-cases as you type and ignores spaces, because a code read
 * aloud from a printed slip is typed with whatever spacing the reader chooses.
 * The server normalises identically, so the two can never disagree.
 */
export function ActivateForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(activateAction, null);

  const [code, setCode] = useState('');
  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {failed ? (
        <Alert
          tone={failed.code === 'FORBIDDEN' ? 'danger' : 'warn'}
          title={
            failed.code === 'FORBIDDEN'
              ? 'That code belongs to someone else'
              : 'That did not work'
          }
        >
          {failed.error}
        </Alert>
      ) : null}

      <Field
        label="Access code"
        hint="Looks like FDN-JSS1-ABCD1234. Capital letters and numbers only."
        error={failed?.fieldErrors?.code}
        required
      >
        <Input
          name="code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(/\s+/g, ''))
          }
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={40}
          required
          autoFocus
          disabled={disabled}
          placeholder="FDN-JSS1-ABCD1234"
          className="text-center font-mono text-lg font-bold tracking-[0.18em]"
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        block
        disabled={disabled || code.length < 6}
        loading={pending}
        loadingLabel="Checking your code…"
        iconLeft={<Unlock className="size-4" aria-hidden />}
      >
        Activate my account
      </Button>
    </form>
  );
}
