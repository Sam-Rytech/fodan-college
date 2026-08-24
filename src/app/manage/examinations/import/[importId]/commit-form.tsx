'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { commitImportAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select, Field, Toggle, FieldSet } from '@/components/ui/field';

export function CommitForm({
  importId,
  classes,
  subjects,
}: {
  importId: string;
  classes: any[];
  subjects: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(commitImportAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.push('/manage/examinations');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.fieldErrors : {};

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="importId" value={importId} />

      <FieldSet>
        <Field label="Examination Title" error={errors?.title} required>
          <Input name="title" placeholder="e.g. End of Term Mathematics" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class" error={errors?.classId} required>
            <Select name="classId" defaultValue="">
              <option value="" disabled>Select class...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Subject" error={errors?.subjectId} required>
            <Select name="subjectId" defaultValue="">
              <option value="" disabled>Select subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Instructions" error={errors?.instructions}>
          <Textarea 
            name="instructions" 
            placeholder="Instructions for students taking this exam" 
            rows={2} 
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Scoring & Rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duration (Minutes)" error={errors?.durationMins} required>
            <Input name="durationMins" type="number" defaultValue={30} />
          </Field>

          <Field label="Marks per Question" error={errors?.marksPerQuestion} required>
            <Input name="marksPerQuestion" type="number" defaultValue={1} />
          </Field>
          
          <Field label="Pass Mark (%)" error={errors?.passMark} required>
            <Input name="passMark" type="number" defaultValue={40} />
          </Field>

          <Field label="Attempt Limit" error={errors?.attemptLimit} required>
            <Input name="attemptLimit" type="number" defaultValue={1} />
          </Field>
        </div>
      </FieldSet>

      <FieldSet legend="Experience">
        <Toggle name="shuffleQuestions" defaultChecked value="true" label="Shuffle Questions" />
        <Toggle name="shuffleOptions" defaultChecked={false} value="true" label="Shuffle Options" />
        <Toggle name="showCorrectAnswers" defaultChecked={false} value="true" label="Show Correct Answers After Completion" />
      </FieldSet>
      
      <FieldSet legend="Availability">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Available From" error={errors?.availableFrom}>
            <Input name="availableFrom" type="datetime-local" />
          </Field>
          <Field label="Available To" error={errors?.availableTo}>
            <Input name="availableTo" type="datetime-local" />
          </Field>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">Leave empty if the exam should be available indefinitely (once published).</p>
      </FieldSet>

      {state?.ok === false && state.message && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.message}
        </div>
      )}

      <div className="pt-4 border-t border-[var(--line-soft)] flex justify-end">
        <Button type="submit" loading={pending}>
          Commit Examination
        </Button>
      </div>
    </form>
  );
}
