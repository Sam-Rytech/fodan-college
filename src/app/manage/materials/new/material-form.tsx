'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { uploadMaterialAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Select, Field, FieldSet, Textarea, Toggle } from '@/components/ui/field';
import { Upload } from 'lucide-react';

export function MaterialForm({
  topics,
}: {
  topics: any[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadMaterialAction, null);

  React.useEffect(() => {
    if (state?.ok) {
      router.push('/manage/materials');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.fieldErrors : {};

  return (
    <form action={action} className="space-y-8">
      <FieldSet legend="Material Details">
        <Field label="Title" error={errors?.title} required>
          <Input name="title" placeholder="e.g. Introduction to Algebra" />
        </Field>
        
        <Field label="Description" error={errors?.description}>
          <Textarea name="description" placeholder="Optional description..." rows={3} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Topic" error={errors?.topicId} required>
            <Select name="topicId" defaultValue="">
              <option value="" disabled>Select a topic...</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.schoolClass.name} - {t.subject.name}: {t.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Material Type" error={errors?.type} required>
            <Select name="type" defaultValue="PDF">
              <option value="PDF">PDF Document</option>
              <option value="DOCX">Word Document (.docx)</option>
              <option value="PPTX">PowerPoint (.pptx)</option>
              <option value="VIDEO">Video (.mp4)</option>
              <option value="AUDIO">Audio (.mp3)</option>
            </Select>
          </Field>
        </div>
      </FieldSet>

      <FieldSet legend="File Upload">
        <div className="flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
            <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md bg-white font-semibold text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2 hover:text-brand-500"
              >
                <span>Upload a file</span>
                <input id="file-upload" name="file" type="file" className="sr-only" required />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
          </div>
        </div>
      </FieldSet>

      <FieldSet legend="Settings">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Publish Status" error={errors?.status} required>
            <Select name="status" defaultValue="DRAFT">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </Select>
          </Field>
          <Field label="Order Index" error={errors?.orderIndex}>
            <Input name="orderIndex" type="number" defaultValue={0} />
          </Field>
        </div>
        <Toggle name="downloadable" value="true" label="Allow students to download this file" defaultChecked />
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
        <Button type="submit" loading={pending} iconLeft={<Upload className="size-4" />}>
          Upload Material
        </Button>
      </div>
    </form>
  );
}
