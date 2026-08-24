'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { saveSubjectAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Field, Toggle, FieldSet, Checkbox } from '@/components/ui/field';

export function SubjectForm({
  initialData,
  availableClasses,
}: {
  initialData: any | null;
  availableClasses: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveSubjectAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.push('/manage/subjects');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.fieldErrors : {};
  const selectedClassIds = initialData?.classes?.map((c: any) => c.classId) || [];

  return (
    <form action={action} className="space-y-6">
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}

      <FieldSet legend="Subject Details">
        <Field label="Subject Name" error={errors?.name} required>
          <Input
            name="name"
            defaultValue={initialData?.name ?? ''}
            placeholder="e.g. Mathematics"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Subject Code" error={errors?.code} required>
            <Input
              name="code"
              defaultValue={initialData?.code ?? ''}
              placeholder="e.g. MATH101"
            />
          </Field>
          <Field label="Order Index" error={errors?.orderIndex} required>
            <Input
              name="orderIndex"
              type="number"
              defaultValue={initialData?.orderIndex ?? 0}
            />
          </Field>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Color Key" error={errors?.colorKey}>
            <Input
              name="colorKey"
              defaultValue={initialData?.colorKey ?? 'blue'}
              placeholder="e.g. blue, red, green"
            />
          </Field>
          <Field label="Icon Key" error={errors?.iconKey}>
            <Input
              name="iconKey"
              defaultValue={initialData?.iconKey ?? 'book'}
              placeholder="e.g. book, calculator"
            />
          </Field>
        </div>

        <Field label="Description" error={errors?.description}>
          <Textarea
            name="description"
            defaultValue={initialData?.description ?? ''}
            placeholder="Optional details about this subject."
            rows={3}
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Class Assignments" description="Select the classes that offer this subject.">
        <div className="grid gap-3 sm:grid-cols-2">
          {availableClasses.map((cls) => (
            <Checkbox
              key={cls.id}
              name="classIds"
              value={cls.id}
              defaultChecked={selectedClassIds.includes(cls.id)}
              label={cls.name}
              description={cls.level}
            />
          ))}
        </div>
      </FieldSet>

      <FieldSet legend="Status">
        <Toggle
          name="isActive"
          defaultChecked={initialData?.isActive ?? true}
          value="true"
          label="Active Subject"
          description="If disabled, this subject will not appear for students."
        />
      </FieldSet>

      {state?.ok === false && state.error && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line-soft)]">
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {initialData ? 'Save Changes' : 'Create Subject'}
        </Button>
      </div>
    </form>
  );
}
