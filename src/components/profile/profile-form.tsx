'use client';

import { useActionState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldSet, Input, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/actions';
import { updateOwnProfileAction } from '@/app/student/actions';

export interface ProfileFormValues {
  fullName: string;
  email: string | null;
  phone: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
}

/**
 * Editing one's own profile.
 *
 * Only fields that genuinely belong to the person are here. Username, role,
 * class and activation state are all absent — those are decisions the school
 * makes, and a form that offered them would have to reject the submission.
 */
export function ProfileForm({
  values,
  showGuardian = false,
}: {
  values: ProfileFormValues;
  showGuardian?: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(updateOwnProfileAction, null);

  const { toast } = useToast();

  useEffect(() => {
    if (state?.ok) {
      toast({ tone: 'success', title: 'Profile saved', description: state.message });
    }
  }, [state, toast]);

  const failed = state && !state.ok ? state : null;
  const fieldErrors = failed?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {failed ? <Alert tone="danger">{failed.error}</Alert> : null}

      <FieldSet legend="Your details">
        <Field label="Full name" error={fieldErrors.fullName} required>
          <Input
            name="fullName"
            defaultValue={values.fullName}
            autoComplete="name"
            required
          />
        </Field>

        <Field
          label="Email address"
          hint="Changing this means you will need to verify the new address."
          error={fieldErrors.email}
        >
          <Input
            name="email"
            type="email"
            defaultValue={values.email ?? ''}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>

        <Field label="Phone number" error={fieldErrors.phone}>
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={values.phone ?? ''}
            autoComplete="tel"
            placeholder="08012345678"
          />
        </Field>
      </FieldSet>

      {showGuardian ? (
        <FieldSet
          legend="Parent or guardian"
          description="So the school can reach someone if you need support."
        >
          <Field label="Guardian's name" error={fieldErrors.guardianName}>
            <Input name="guardianName" defaultValue={values.guardianName ?? ''} />
          </Field>
          <Field label="Guardian's phone" error={fieldErrors.guardianPhone}>
            <Input
              name="guardianPhone"
              type="tel"
              inputMode="tel"
              defaultValue={values.guardianPhone ?? ''}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth" error={fieldErrors.dateOfBirth}>
              <Input
                name="dateOfBirth"
                type="date"
                defaultValue={values.dateOfBirth ?? ''}
                max={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Gender" error={fieldErrors.gender}>
              <Select name="gender" defaultValue={values.gender ?? ''}>
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </Select>
            </Field>
          </div>
        </FieldSet>
      ) : null}

      <Button
        type="submit"
        loading={pending}
        loadingLabel="Saving…"
        iconLeft={<Save className="size-4" aria-hidden />}
      >
        Save changes
      </Button>
    </form>
  );
}
