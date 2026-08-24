'use client';

import { useActionState, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FieldSet, Input, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { PasswordInput } from '@/components/ui/password-input';
import { STUDENT_TYPES, type StudentType } from '@/lib/constants';
import type { ActionResult } from '@/lib/actions';
import { registerAction } from '../actions';

interface ClassOption {
  id: string;
  name: string;
  level: string;
}

export function RegisterForm({ classes }: { classes: ClassOption[] }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(registerAction, null);

  const [studentType, setStudentType] = useState<StudentType>(
    STUDENT_TYPES.SECONDARY,
  );
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  // The class list narrows to match the chosen level, so a Primary 3 pupil is
  // never offered SS 2 — a small guard against the most common typo.
  const classOptions = useMemo(
    () => classes.filter((option) => option.level === studentType),
    [classes, studentType],
  );

  const failed = state && !state.ok ? state : null;
  const fieldErrors = failed?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {failed ? <Alert tone="danger">{failed.error}</Alert> : null}

      <FieldSet legend="About you">
        <Field label="Full name" error={fieldErrors.fullName} required>
          <Input
            name="fullName"
            autoComplete="name"
            required
            placeholder="e.g. Chidinma Grace Eze"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>

        <Field
          label="Username"
          hint="This is what you type when you sign in. Letters, numbers, dots and dashes."
          error={fieldErrors.username}
          required
        >
          <Input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="e.g. chidinma.eze"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>
      </FieldSet>

      <FieldSet
        legend="How we reach you"
        description="Give at least one — an email address or a phone number."
      >
        <Field label="Email address" error={fieldErrors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          label="Phone number"
          hint="Nigerian numbers may be typed as 08012345678."
          error={fieldErrors.phone}
        >
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="08012345678"
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Your class">
        <Field label="Are you in Primary or Secondary?" required>
          <Select
            name="studentType"
            value={studentType}
            onChange={(event) =>
              setStudentType(event.target.value as StudentType)
            }
            required
          >
            <option value={STUDENT_TYPES.PRIMARY}>Primary school</option>
            <option value={STUDENT_TYPES.SECONDARY}>Secondary school</option>
          </Select>
        </Field>

        <Field
          label="Class"
          hint="Not sure? You can choose it later, or your teacher will set it."
          error={fieldErrors.classId}
        >
          <Select name="classId" defaultValue="">
            <option value="">I will choose later</option>
            {classOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </Field>
      </FieldSet>

      <FieldSet
        legend="Parent or guardian"
        description="Optional, but it helps the school reach someone if you need support."
      >
        <Field label="Guardian's name" error={fieldErrors.guardianName}>
          <Input name="guardianName" placeholder="e.g. Mrs Ngozi Eze" />
        </Field>
        <Field label="Guardian's phone" error={fieldErrors.guardianPhone}>
          <Input name="guardianPhone" type="tel" inputMode="tel" placeholder="08012345678" />
        </Field>
      </FieldSet>

      <FieldSet legend="Choose a password">
        <Field label="Password" error={fieldErrors.password} required>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            showMeter
            context={{ fullName, username, email }}
            placeholder="At least 8 characters"
          />
        </Field>

        <Field
          label="Confirm password"
          error={fieldErrors.confirmPassword}
          required
        >
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
            placeholder="Type it once more"
          />
        </Field>
      </FieldSet>

      <Checkbox
        name="acceptTerms"
        value="true"
        required
        label="I agree to use this platform respectfully"
        description="Be kind in the forum, do your own work, and never share your password."
      />
      {fieldErrors.acceptTerms ? (
        <p className="text-xs font-medium text-danger-600">
          {fieldErrors.acceptTerms[0]}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        block
        loading={pending}
        loadingLabel="Creating your account…"
        iconLeft={<UserPlus className="size-4" aria-hidden />}
      >
        Create my account
      </Button>
    </form>
  );
}
