import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { CommitForm } from './commit-form';
import type { ImportIssue, ParsedQuestion } from '@/lib/exam/question-parser';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Review Import' };

export default async function ReviewImportPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = await params;
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_EXAMS);

  const importRecord = await prisma.examImport.findUnique({
    where: { id: importId },
    include: { file: true },
  });

  if (!importRecord) notFound();

  // If already committed, send back to the exam list
  if (importRecord.status !== 'PARSED') {
    redirect('/manage/examinations');
  }

  const issues: ImportIssue[] = JSON.parse(importRecord.issues);
  const questions: ParsedQuestion[] = JSON.parse(importRecord.payload);
  const hasErrors = importRecord.errorCount > 0;

  const classes = await prisma.schoolClass.findMany({ orderBy: { orderIndex: 'asc' } });
  const subjects = await prisma.subject.findMany({ orderBy: { orderIndex: 'asc' } });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Review Examination Import
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Document: <strong>{importRecord.file.originalName}</strong> ({importRecord.questionCount} questions found)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
            <h2 className="text-lg font-semibold mb-4">Parsing Results</h2>
            
            {hasErrors ? (
              <div className="mb-4 rounded-md bg-danger-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-danger-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-danger-800">
                      Found {importRecord.errorCount} error(s) and {importRecord.warningCount} warning(s)
                    </h3>
                    <div className="mt-2 text-sm text-danger-700">
                      <p>You must fix the errors in your document and re-upload it before you can commit.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-md bg-success-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-success-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-success-800">
                      Ready to commit ({importRecord.warningCount} warnings)
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {issues.length > 0 && (
              <ul className="space-y-3 mt-4">
                {issues.map((issue, idx) => (
                  <li key={idx} className={`text-sm p-3 rounded-md border ${
                    issue.severity === 'error' 
                      ? 'border-danger-200 bg-danger-50/50 text-danger-800' 
                      : 'border-warning-200 bg-warning-50/50 text-warning-800'
                  }`}>
                    <div className="flex items-start gap-2">
                      {issue.severity === 'error' ? (
                        <AlertCircle className="size-4 mt-0.5 text-danger-500" />
                      ) : (
                        <AlertTriangle className="size-4 mt-0.5 text-warning-500" />
                      )}
                      <div>
                        <strong>{issue.questionNumber ? `Q${issue.questionNumber}: ` : ''}</strong>
                        {issue.message}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {hasErrors && (
              <div className="mt-6 pt-4 border-t border-[var(--line-soft)] flex justify-end">
                <Button variant="secondary" asChild>
                  <Link href="/manage/examinations/import">Upload Corrected File</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {!hasErrors && (
            <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
              <h2 className="text-lg font-semibold mb-4">Examination Settings</h2>
              <CommitForm 
                importId={importId} 
                classes={classes} 
                subjects={subjects} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
