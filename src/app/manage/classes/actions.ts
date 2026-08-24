'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { classSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { slugify } from '@/lib/utils';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function saveClassAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_CLASSES);

    const input = parseForm(classSchema, formData);
    const slug = slugify(input.name);

    if (input.id) {
      const existing = await prisma.schoolClass.findUnique({ where: { id: input.id } });
      if (!existing) throw new Error('Class not found');

      await prisma.schoolClass.update({
        where: { id: input.id },
        data: {
          name: input.name,
          slug,
          level: input.level,
          description: input.description,
          orderIndex: input.orderIndex,
          isActive: input.isActive,
        },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.UPDATE,
        actor: user,
        targetType: 'class',
        targetId: input.id,
        description: `Updated class: ${input.name}`,
      });
    } else {
      const newClass = await prisma.schoolClass.create({
        data: {
          name: input.name,
          slug,
          level: input.level,
          description: input.description,
          orderIndex: input.orderIndex,
          isActive: input.isActive,
        },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.CREATE,
        actor: user,
        targetType: 'class',
        targetId: newClass.id,
        description: `Created new class: ${input.name}`,
      });
    }

    revalidatePath('/manage/classes');
    return actionSuccess(null, 'Class saved successfully.');
  });
}
