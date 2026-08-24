'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { saveClassAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select, Field, Toggle, FieldSet } from '@/components/ui/field';
import { STUDENT_TYPE_KEYS } from '@/lib/constants';

export function ClassForm({ initialData }: { initialData: any | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveClassAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.push('/manage/classes');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.details : {};

  return (
    <form action={action} className="space-y-6">
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}

      <FieldSet legend="Class Details">
        <Field label="Class Name" error={errors?.name} required>
          <Input
            name="name"
            defaultValue={initialData?.name ?? ''}
            placeholder="e.g. JSS 1"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Level" error={errors?.level} required>
            <Select name="level" defaultValue={initialData?.level ?? STUDENT_TYPE_KEYS[0]}>
              {STUDENT_TYPE_KEYS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Order Index" error={errors?.orderIndex} required>
            <Input
              name="orderIndex"
              type="number"
              defaultValue={initialData?.orderIndex ?? 0}
            />
          </Field>
        </div>

        <Field label="Description" error={errors?.description}>
          <Textarea
            name="description"
            defaultValue={initialData?.description ?? ''}
            placeholder="Optional details about this class."
            rows={3}
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Status">
        <Toggle
          name="isActive"
          defaultChecked={initialData?.isActive ?? true}
          value="true"
          label="Active Class"
          description="If disabled, students in this class cannot be assigned new materials or exams."
        />
      </FieldSet>

      {state?.ok === false && state.message && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line-soft)]">
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {initialData ? 'Save Changes' : 'Create Class'}
        </Button>
      </div>
    </form>
  );
}
