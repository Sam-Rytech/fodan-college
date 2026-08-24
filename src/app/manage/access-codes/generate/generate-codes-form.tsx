'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { bulkGenerateCodesAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Select, Field, FieldSet, Checkbox } from '@/components/ui/field';
import { Key } from 'lucide-react';
import type { GeneratedCode } from '@/lib/access-codes';

export function GenerateCodesForm({
  students,
  classes,
}: {
  students: any[];
  classes: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(bulkGenerateCodesAction, null);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[] | null>(null);

  React.useEffect(() => {
    if (state?.ok && state.data) {
      setGeneratedCodes(state.data);
    }
  }, [state]);

  if (generatedCodes) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-success-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Key className="h-5 w-5 text-success-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-success-800">
                Successfully generated {generatedCodes.length} code(s)
              </h3>
              <div className="mt-2 text-sm text-success-700">
                <p>Please copy these codes now. For security reasons, you will not be able to view them again.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-md border border-[var(--line-soft)] max-h-96 overflow-y-auto">
          <ul className="space-y-2">
            {generatedCodes.map((c) => {
              const student = students.find(s => s.id === c.studentId);
              return (
                <li key={c.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                  <span className="font-medium text-gray-900">{student?.fullName}</span>
                  <code className="bg-white px-2 py-1 rounded border border-gray-300 font-mono text-lg">{c.code}</code>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => router.push('/manage/access-codes')}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const errors = state?.ok === false ? state.fieldErrors : {};

  return (
    <form action={action} className="space-y-6">
      <FieldSet legend="Select Students" description="Choose which inactive students to generate codes for.">
        <div className="max-h-64 overflow-y-auto p-4 border border-[var(--line-soft)] rounded-md bg-white">
          {students.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No inactive students found.</p>
          ) : (
            <div className="space-y-2">
              {students.map(s => (
                <Checkbox
                  key={s.id}
                  name="studentIds"
                  value={s.id}
                  label={s.fullName}
                  description={`${s.username} • ${s.studentProfile?.schoolClass?.name || 'No Class'}`}
                />
              ))}
            </div>
          )}
        </div>
        {errors?.studentIds && (
          <p className="mt-1 text-sm text-danger-600">{errors.studentIds.join(', ')}</p>
        )}
      </FieldSet>

      <FieldSet legend="Code Settings">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Validity (Days)" error={errors?.validityDays} required>
            <Input name="validityDays" type="number" defaultValue={30} />
          </Field>
          
          <Field label="Target Class (Optional)" error={errors?.classId}>
            <Select name="classId" defaultValue="">
              <option value="">Student's Default Class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Note" error={errors?.note}>
          <Input name="note" placeholder="Optional reference note" />
        </Field>
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
        <Button type="submit" loading={pending} disabled={students.length === 0}>
          Generate Codes
        </Button>
      </div>
    </form>
  );
}
