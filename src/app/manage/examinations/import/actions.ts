'use server';

import { redirect } from 'next/navigation';
import { actionSuccess, runAction, type ActionResult } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { validateUpload, storeValidatedUpload } from '@/lib/storage';
import { parseExamDocx } from '@/lib/exam/docx';

export async function uploadExamDocxAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  let importId: string | undefined;

  const result = await runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_EXAMS);

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error('Please select a DOCX file to upload.');
    }

    // 1. Validate it's actually a DOCX
    const upload = await validateUpload(file, { kind: 'exam-docx' });

    // 2. Parse the contents using mammoth and our question parser
    const parsed = await parseExamDocx(upload.buffer);

    // 3. Store the physical file (in case we need to re-parse later)
    const storedFile = await storeValidatedUpload(upload, {
      prefix: 'imports',
      uploadedById: user.id,
    });

    // 4. Create the ExamImport record
    const examImport = await prisma.examImport.create({
      data: {
        fileId: storedFile.id,
        status: 'PARSED',
        questionCount: parsed.stats.questionCount,
        errorCount: parsed.stats.errorCount,
        warningCount: parsed.stats.warningCount,
        payload: JSON.stringify(parsed.questions),
        issues: JSON.stringify(parsed.issues),
        createdById: user.id,
      },
    });

    importId = examImport.id;
    return actionSuccess(null);
  });

  if (!result.ok || !importId) return result;

  redirect(`/manage/examinations/import/${importId}`);
}
