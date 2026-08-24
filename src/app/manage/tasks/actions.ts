'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { taskSchema, taskStatusSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { guardStaff , requirePermission} from '@/lib/auth/guards';

import { PERMISSIONS, TASK_STATUS } from '@/lib/constants';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function createTaskAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    // Everyone can create tasks for others, but let's say they need to be an admin
    // In a real app we might restrict who can assign to whom, but for now we just require STAFF

    const input = parseForm(taskSchema, formData);

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        assignedToId: input.assignedToId,
        priority: input.priority,
        dueDate: input.dueDate,
        createdById: user.id,
      },
    });

    await prisma.taskHistory.create({
      data: {
        taskId: task.id,
        actorId: user.id,
        action: 'CREATED',
        toStatus: TASK_STATUS.PENDING,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.TASK_CREATED,
      actor: user,
      targetType: 'task',
      targetId: task.id,
      description: `Created and assigned task: ${task.title}`,
    });

    revalidatePath('/manage/tasks');
    return actionSuccess(null, 'Task created and assigned successfully.');
  });
}

export async function setTaskStatusAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();

    const input = parseForm(taskStatusSchema, formData);
    const task = await prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) throw new Error('Task not found');
    if (task.status === input.status) return actionSuccess(null, 'Status unchanged');

    const isComplete = input.status === TASK_STATUS.COMPLETED;

    await prisma.$transaction([
      prisma.task.update({
        where: { id: input.taskId },
        data: {
          status: input.status,
          startedAt: task.status === TASK_STATUS.PENDING && input.status === TASK_STATUS.IN_PROGRESS ? new Date() : undefined,
          completedAt: isComplete ? new Date() : undefined,
          completedById: isComplete ? user.id : undefined,
          completionNote: isComplete ? input.note : undefined,
        },
      }),
      prisma.taskHistory.create({
        data: {
          taskId: input.taskId,
          actorId: user.id,
          action: 'STATUS_CHANGED',
          fromStatus: task.status,
          toStatus: input.status,
          note: input.note,
        },
      }),
    ]);

    revalidatePath('/manage/tasks');
    return actionSuccess(null, `Task status updated to ${input.status}.`);
  });
}
