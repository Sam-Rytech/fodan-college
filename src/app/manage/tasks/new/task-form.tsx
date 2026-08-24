'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { createTaskAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Select, Field, FieldSet, Textarea } from '@/components/ui/field';

export function TaskForm({
  staff,
}: {
  staff: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createTaskAction, null);

  React.useEffect(() => {
    if (state?.ok) {
      router.push('/manage/tasks');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.details : {};

  return (
    <form action={action} className="space-y-8">
      <FieldSet legend="Task Details">
        <Field label="Title" error={errors?.title} required>
          <Input name="title" placeholder="e.g. Grade Term 1 Mathematics Exams" />
        </Field>
        
        <Field label="Description" error={errors?.description}>
          <Textarea name="description" placeholder="Instructions for the task..." rows={4} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Assign To" error={errors?.assignedToId} required>
            <Select name="assignedToId" defaultValue="">
              <option value="" disabled>Select a staff member...</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" error={errors?.priority} required>
            <Select name="priority" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>

          <Field label="Due Date" error={errors?.dueDate}>
            <Input name="dueDate" type="date" />
          </Field>
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
          Create Task
        </Button>
      </div>
    </form>
  );
}
