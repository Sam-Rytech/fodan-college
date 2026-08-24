'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { commitImportSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';
import type { ParsedQuestion } from '@/lib/exam/question-parser';

export async function commitImportAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_EXAMS);

    const input = parseForm(commitImportSchema, formData);

    const examImport = await prisma.examImport.findUnique({
      where: { id: input.importId },
    });
    if (!examImport) throw new Error('Import not found.');
    if (examImport.status !== 'PARSED') throw new Error('This import has already been committed or discarded.');
    if (examImport.errorCount > 0) throw new Error('Cannot commit an import with errors.');

    const questions: ParsedQuestion[] = JSON.parse(examImport.payload);
    const totalQuestions = questions.length;
    const marksPerQuestion = input.marksPerQuestion;
    const totalMarks = totalQuestions * marksPerQuestion;

    // Use a transaction to commit the exam and all its questions
    const examination = await prisma.$transaction(async (tx) => {
      const exam = await tx.examination.create({
        data: {
          title: input.title,
          subjectId: input.subjectId,
          classId: input.classId,
          instructions: input.instructions,
          durationMins: input.durationMins,
          totalQuestions,
          totalMarks,
          passMark: input.passMark,
          attemptLimit: input.attemptLimit,
          availableFrom: input.availableFrom,
          availableTo: input.availableTo,
          shuffleQuestions: input.shuffleQuestions,
          shuffleOptions: input.shuffleOptions,
          showCorrectAnswers: input.showCorrectAnswers,
          sourceFileId: examImport.fileId,
          createdById: user.id,
          status: 'DRAFT', // Always create as DRAFT first
        },
      });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q) continue;

        await tx.examQuestion.create({
          data: {
            examId: exam.id,
            number: i + 1,
            text: q.text,
            marks: marksPerQuestion,
            options: {
              create: q.options.map((opt, optIdx) => ({
                label: opt.label,
                text: opt.text,
                isCorrect: opt.isCorrect,
                orderIndex: optIdx,
              })),
            },
          },
        });
      }

      await tx.examImport.update({
        where: { id: input.importId },
        data: {
          status: 'COMMITTED',
          examId: exam.id,
        },
      });

      return exam;
    });

    await recordAudit({
      action: AUDIT_ACTIONS.CREATE,
      actor: user,
      targetType: 'examination',
      targetId: examination.id,
      description: `Imported examination: ${examination.title}`,
    });

    revalidatePath('/manage/examinations');
    return actionSuccess(null, 'Examination imported successfully.');
  });
}
