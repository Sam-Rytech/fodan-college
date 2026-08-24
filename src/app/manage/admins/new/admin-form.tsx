'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { createAdminAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Field, FieldSet, Checkbox } from '@/components/ui/field';

export function AdminForm({
  permissions,
  classes,
  subjects,
}: {
  permissions: any[];
  classes: any[];
  subjects: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createAdminAction, null);

  React.useEffect(() => {
    if (state?.ok) {
      router.push('/manage/admins');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.details : {};

  return (
    <form action={action} className="space-y-8">
      <FieldSet legend="Personal Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" error={errors?.fullName} required>
            <Input name="fullName" placeholder="Jane Doe" />
          </Field>
          <Field label="Username" error={errors?.username} required>
            <Input name="username" placeholder="janedoe" />
          </Field>
          <Field label="Email Address" error={errors?.email} required>
            <Input name="email" type="email" placeholder="jane@example.com" />
          </Field>
          <Field label="Phone Number" error={errors?.phone}>
            <Input name="phone" type="tel" placeholder="+234..." />
          </Field>
          <Field label="Temporary Password" error={errors?.temporaryPassword} required>
            <Input name="temporaryPassword" type="password" />
            <p className="mt-1 text-xs text-[var(--text-muted)]">They will be forced to change this upon first login.</p>
          </Field>
        </div>
      </FieldSet>

      <FieldSet legend="Access Controls">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium">Capabilities</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-[var(--line-soft)] rounded-md">
              {permissions.map(p => (
                <Checkbox key={p.id} name="permissions" value={p.key} label={p.name} />
              ))}
            </div>
            {errors?.permissions && <p className="mt-1 text-xs text-danger-600">{errors.permissions.join(', ')}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Class Scopes</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-[var(--line-soft)] rounded-md">
              {classes.map(c => (
                <Checkbox key={c.id} name="classIds" value={c.id} label={c.name} />
              ))}
            </div>
            {errors?.classIds && <p className="mt-1 text-xs text-danger-600">{errors.classIds.join(', ')}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Subject Scopes</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto p-3 border border-[var(--line-soft)] rounded-md">
              {subjects.map(s => (
                <Checkbox key={s.id} name="subjectIds" value={s.id} label={s.name} />
              ))}
            </div>
            {errors?.subjectIds && <p className="mt-1 text-xs text-danger-600">{errors.subjectIds.join(', ')}</p>}
          </div>
        </div>
      </FieldSet>

      {state?.ok === false && state.message && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line-soft)]">
        <Button variant="ghost" type="button" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Create Administrator
        </Button>
      </div>
    </form>
  );
}
