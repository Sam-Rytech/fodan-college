'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { uploadExamDocxAction } from './actions';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export default function ImportExamPage() {
  const [state, action, pending] = useActionState(uploadExamDocxAction, null);

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Import Examination
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Upload a DOCX file to automatically extract and parse questions and options.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <form action={action} className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md bg-white font-semibold text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2 hover:text-brand-500"
                  >
                    <span>Upload a file</span>
                    <input id="file-upload" name="file" type="file" accept=".docx" className="sr-only" required />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs leading-5 text-gray-600">.docx Word Document up to 25MB</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-500">
              Your document should have questions numbered, with options below them. 
              Indicate the correct answer by placing an asterisk (*) directly before the option letter.
            </p>
          </div>

          {state?.ok === false && state.error && (
            <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
              {state.error}
            </div>
          )}

          <div className="pt-4 border-t border-[var(--line-soft)] flex justify-end">
            <Button type="submit" loading={pending} iconLeft={<Upload className="size-4" />}>
              Process Document
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
