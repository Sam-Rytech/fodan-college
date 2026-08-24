'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { bulkGenerateCodesSchema, revokeCodeSchema } from '@/lib/validation';
import { generateAccessCodes, revokeAccessCode, type GeneratedCode } from '@/lib/access-codes';

export async function bulkGenerateCodesAction(
  _previous: ActionResult<GeneratedCode[]> | null,
  formData: FormData,
): Promise<ActionResult<GeneratedCode[]>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_STUDENTS);

    // Because studentIds might be multiple checkboxes, we must parse them
    const allFormData = new FormData();
    for (const [key, value] of formData.entries()) {
      allFormData.append(key, value);
    }
    const studentIds = allFormData.getAll('studentIds').map(String);
    
    const rawData = Object.fromEntries(formData.entries());
    rawData.studentIds = studentIds as any;

    const input = bulkGenerateCodesSchema.parse(rawData);

    const generated = await generateAccessCodes(input.studentIds, {
      classId: input.classId,
      validityDays: input.validityDays,
      note: input.note,
      actor: user,
    });

    revalidatePath('/manage/access-codes');
    return actionSuccess(generated, `Successfully generated ${generated.length} access code(s).`);
  });
}

export async function revokeCodeAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_STUDENTS);

    const input = parseForm(revokeCodeSchema, formData);

    await revokeAccessCode(input.codeId, input.reason, user);

    revalidatePath('/manage/access-codes');
    return actionSuccess(null, 'Access code revoked.');
  });
}
