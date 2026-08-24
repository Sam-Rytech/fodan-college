'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { materialMetadataSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { validateUpload, storeValidatedUpload } from '@/lib/storage';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function uploadMaterialAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_MATERIALS);

    const input = parseForm(materialMetadataSchema, formData);

    const topic = await prisma.topic.findUnique({
      where: { id: input.topicId },
    });
    if (!topic) throw new Error('Topic not found.');

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error('Please select a file to upload.');
    }

    // 1. Validate Upload
    const upload = await validateUpload(file, { expect: input.type as any });

    // 2. Store physically
    const storedFile = await storeValidatedUpload(upload, {
      prefix: 'materials',
      uploadedById: user.id,
    });

    // 3. Create material
    const material = await prisma.learningMaterial.create({
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        topicId: input.topicId,
        subjectId: topic.subjectId,
        classId: topic.classId,
        fileId: storedFile.id,
        status: input.status,
        orderIndex: input.orderIndex,
        downloadable: input.downloadable,
        uploadedById: user.id,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.MATERIAL_CREATED,
      actor: user,
      targetType: 'learning_material',
      targetId: material.id,
      description: `Uploaded learning material: ${material.title}`,
    });

    revalidatePath('/manage/materials');
    return actionSuccess(null, 'Material uploaded successfully.');
  });
}
