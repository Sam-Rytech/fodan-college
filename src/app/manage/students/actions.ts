'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { createStudentSchema, updateStudentSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';
import { classScopeFilter } from '@/lib/auth/rbac';
import { PERMISSIONS, ROLES, USER_STATUS } from '@/lib/constants';
import { hashPassword } from '@/lib/password';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function saveStudentAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_STUDENTS);

    const isUpdate = formData.has('userId');
    
    if (isUpdate) {
      const input = parseForm(updateStudentSchema, formData);
      const scope = classScopeFilter(user);
      
      const profile = await prisma.studentProfile.findFirst({
        where: { userId: input.userId, ...scope },
        include: { user: true },
      });
      if (!profile) throw new Error('Student not found or not in your jurisdiction');

      await prisma.$transaction([
        prisma.user.update({
          where: { id: input.userId },
          data: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
          },
        }),
        prisma.studentProfile.update({
          where: { userId: input.userId },
          data: {
            classId: input.classId,
            studentType: input.studentType,
            admissionNumber: input.admissionNumber,
            guardianName: input.guardianName,
            guardianPhone: input.guardianPhone,
          },
        })
      ]);

      await recordAudit({
        action: AUDIT_ACTIONS.UPDATE,
        actor: user,
        targetType: 'user',
        targetId: input.userId,
        description: `Updated student profile: ${input.fullName}`,
      });
      
      revalidatePath('/manage/students');
      return actionSuccess(null, 'Student updated successfully.');
    } else {
      const input = parseForm(createStudentSchema, formData);
      
      const role = await prisma.role.findUnique({ where: { key: ROLES.STUDENT } });
      if (!role) throw new Error('Student role not found');
      
      const passwordHash = await hashPassword(input.temporaryPassword);

      const newUser = await prisma.user.create({
        data: {
          fullName: input.fullName,
          username: input.username,
          email: input.email,
          phone: input.phone,
          passwordHash,
          roleId: role.id,
          status: USER_STATUS.ACTIVE,
          mustChangePassword: true,
          studentProfile: {
            create: {
              classId: input.classId,
              studentType: input.studentType,
              admissionNumber: input.admissionNumber,
              guardianName: input.guardianName,
              guardianPhone: input.guardianPhone,
              isActivated: false,
            },
          },
        },
      });

      await recordAudit({
        action: AUDIT_ACTIONS.CREATE,
        actor: user,
        targetType: 'user',
        targetId: newUser.id,
        description: `Created new student: ${input.fullName}`,
      });
      
      revalidatePath('/manage/students');
      return actionSuccess(null, 'Student registered successfully.');
    }
  });
}
