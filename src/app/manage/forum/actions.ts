'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, runAction, type ActionResult } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function resolveReportAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_FORUM);

    const reportId = formData.get('reportId') as string;
    const action = formData.get('action') as 'ACTIONED' | 'DISMISSED';

    if (!reportId || !action) {
      throw new Error('Invalid request parameters.');
    }

    const report = await prisma.forumReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new Error('Report not found.');

    await prisma.forumReport.update({
      where: { id: reportId },
      data: {
        status: action,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    // If actioned, we should also hide the post/reply (this is a simple convention for now)
    if (action === 'ACTIONED') {
      if (report.postId) {
        await prisma.forumPost.update({
          where: { id: report.postId },
          data: { status: 'HIDDEN', moderatedById: user.id, moderatedAt: new Date() },
        });
      } else if (report.replyId) {
        await prisma.forumReply.update({
          where: { id: report.replyId },
          data: { status: 'HIDDEN', moderatedById: user.id, moderatedAt: new Date() },
        });
      }
    }

    await recordAudit({
      action: AUDIT_ACTIONS.FORUM_MODERATED,
      actor: user,
      targetType: 'forum_report',
      targetId: reportId,
      description: `Forum report ${action.toLowerCase()} for ${report.postId ? 'post' : 'reply'}.`,
    });

    revalidatePath('/manage/forum');
    return actionSuccess(null, `Report marked as ${action.toLowerCase()}.`);
  });
}
