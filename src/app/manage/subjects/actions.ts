'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { subjectSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { slugify } from '@/lib/utils';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function saveSubjectAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_SUBJECTS);

    // Ensure all classIds are collected, FormData might have multiple 'classIds' entries
    const allFormData = new FormData();
    for (const [key, value] of formData.entries()) {
      allFormData.append(key, value);
    }
    const classIds = allFormData.getAll('classIds').map(String);
    if (classIds.length > 0) {
      // subjectSchema expects a single array or comma-separated string, 
      // but FormData from standard forms with multiple checkboxes 
      // might need to be parsed properly. 
      // parseForm uses Object.fromEntries(formData), which ignores duplicates!
      // So we must manually inject classIds back or let parseForm handle it if it supports multiple.
      // Actually parseForm from our codebase might not handle multiple fields with same name correctly 
      // unless we format it. Let's pass it as a JSON string or array if needed.
    }

    // Since parseForm does Object.fromEntries(formData.entries()), it will only get the LAST classId!
    // We should build a plain object and pass to subjectSchema.parse()
    const rawData = Object.fromEntries(formData.entries());
    rawData.classIds = classIds as any; // Override with full array
    
    const input = subjectSchema.parse(rawData);
    const slug = slugify(input.name);

    if (input.id) {
      const existing = await prisma.subject.findUnique({ where: { id: input.id } });
      if (!existing) throw new Error('Subject not found');

      await prisma.subject.update({
        where: { id: input.id },
        data: {
          name: input.name,
          slug,
          code: input.code,
          description: input.description,
          orderIndex: input.orderIndex,
          isActive: input.isActive,
          colorKey: input.colorKey,
          iconKey: input.iconKey,
          classes: {
            deleteMany: {}, // Clear existing class associations
            create: input.classIds?.map((cId) => ({ classId: cId })) || [],
          },
        },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.UPDATE,
        actor: user,
        targetType: 'subject',
        targetId: input.id,
        description: `Updated subject: ${input.name}`,
      });
    } else {
      const newSubject = await prisma.subject.create({
        data: {
          name: input.name,
          slug,
          code: input.code,
          description: input.description,
          orderIndex: input.orderIndex,
          isActive: input.isActive,
          colorKey: input.colorKey,
          iconKey: input.iconKey,
          classes: {
            create: input.classIds?.map((cId) => ({ classId: cId })) || [],
          },
        },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.CREATE,
        actor: user,
        targetType: 'subject',
        targetId: newSubject.id,
        description: `Created new subject: ${input.name}`,
      });
    }

    revalidatePath('/manage/subjects');
    return actionSuccess(null, 'Subject saved successfully.');
  });
}
