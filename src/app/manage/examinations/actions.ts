'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { examStatusSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function setExamStatusAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_EXAMS);

    const input = parseForm(examStatusSchema, formData);

    const exam = await prisma.examination.findUnique({
      where: { id: input.examId },
    });
    if (!exam) throw new Error('Examination not found.');

    await prisma.examination.update({
      where: { id: input.examId },
      data: {
        status: input.status,
        publishedAt: input.status === 'PUBLISHED' && exam.status !== 'PUBLISHED' ? new Date() : undefined,
        closedAt: input.status === 'CLOSED' && exam.status !== 'CLOSED' ? new Date() : undefined,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      actor: user,
      targetType: 'examination',
      targetId: input.examId,
      description: `Changed examination status to ${input.status}`,
    });

    revalidatePath('/manage/examinations');
    return actionSuccess(null, `Examination is now ${input.status}.`);
  });
}
