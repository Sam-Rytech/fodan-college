'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { saveStudentAction } from '../actions';
import { Button } from '@/components/ui/button';
import { Input, Select, Field, FieldSet } from '@/components/ui/field';
import { STUDENT_TYPE_KEYS } from '@/lib/constants';

export function StudentForm({
  initialData,
  classes,
}: {
  initialData: any | null;
  classes: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveStudentAction, null);
  const [selectedLevel, setSelectedLevel] = useState(
    initialData?.studentType || STUDENT_TYPE_KEYS[0]
  );

  useEffect(() => {
    if (state?.ok) {
      router.push('/manage/students');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.details : {};
  
  // Filter classes by selected level
  const availableClasses = classes.filter(c => c.level === selectedLevel);

  return (
    <form action={action} className="space-y-6">
      {initialData?.userId && <input type="hidden" name="userId" value={initialData.userId} />}

      <FieldSet legend="Account Identity">
        <Field label="Full Name" error={errors?.fullName} required>
          <Input
            name="fullName"
            defaultValue={initialData?.user?.fullName ?? ''}
            placeholder="e.g. John Doe"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          {!initialData && (
            <Field label="Username" error={errors?.username} required>
              <Input
                name="username"
                placeholder="e.g. jdoe123"
              />
            </Field>
          )}

          {!initialData && (
            <Field label="Temporary Password" error={errors?.temporaryPassword} required>
              <Input
                name="temporaryPassword"
                type="text"
                placeholder="Required for new accounts"
              />
            </Field>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Email Address" error={errors?.email}>
            <Input
              name="email"
              type="email"
              defaultValue={initialData?.user?.email ?? ''}
              placeholder="Optional"
            />
          </Field>

          <Field label="Phone Number" error={errors?.phone}>
            <Input
              name="phone"
              type="tel"
              defaultValue={initialData?.user?.phone ?? ''}
              placeholder="Optional"
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSet legend="Academic Details">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Student Type (Level)" error={errors?.studentType} required>
            <Select 
              name="studentType" 
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              {STUDENT_TYPE_KEYS.map((level) => (
                <option key={level} value={level}>
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          
          <Field label="Class" error={errors?.classId} required>
            <Select name="classId" defaultValue={initialData?.classId ?? ''}>
              <option value="" disabled>Select a class</option>
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        
        <Field label="Admission Number" error={errors?.admissionNumber}>
          <Input
            name="admissionNumber"
            defaultValue={initialData?.admissionNumber ?? ''}
            placeholder="Optional internal ID"
          />
        </Field>
      </FieldSet>

      <FieldSet legend="Guardian Information">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Guardian Name" error={errors?.guardianName}>
            <Input
              name="guardianName"
              defaultValue={initialData?.guardianName ?? ''}
              placeholder="Parent or guardian name"
            />
          </Field>

          <Field label="Guardian Phone" error={errors?.guardianPhone}>
            <Input
              name="guardianPhone"
              type="tel"
              defaultValue={initialData?.guardianPhone ?? ''}
              placeholder="Parent or guardian phone"
            />
          </Field>
        </div>
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
          {initialData ? 'Save Changes' : 'Register Student'}
        </Button>
      </div>
    </form>
  );
}
