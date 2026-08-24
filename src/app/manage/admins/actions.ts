'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { createAdminSchema, updateAdminAssignmentsSchema, updateAdminPermissionsSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS, ROLES, USER_STATUS } from '@/lib/constants';
import { hashPassword } from '@/lib/password';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';

export async function createAdminAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_ADMINS);

    // parse form arrays manually
    const allFormData = new FormData();
    for (const [key, value] of formData.entries()) {
      allFormData.append(key, value);
    }
    const permissions = allFormData.getAll('permissions').map(String);
    const classIds = allFormData.getAll('classIds').map(String);
    const subjectIds = allFormData.getAll('subjectIds').map(String);

    const rawData = Object.fromEntries(formData.entries());
    rawData.permissions = permissions as any;
    rawData.classIds = classIds as any;
    rawData.subjectIds = subjectIds as any;

    const input = createAdminSchema.parse(rawData);
    const role = await prisma.role.findUnique({ where: { key: ROLES.MINI_ADMIN } });
    if (!role) throw new Error('Mini Admin role not found');
    
    const passwordHash = await hashPassword(input.temporaryPassword);

    // Map permissions keys to IDs
    const dbPermissions = await prisma.permission.findMany({
      where: { key: { in: input.permissions } },
    });
    
    const newAdmin = await prisma.user.create({
      data: {
        fullName: input.fullName,
        username: input.username,
        email: input.email,
        phone: input.phone,
        passwordHash,
        roleId: role.id,
        status: USER_STATUS.ACTIVE,
        mustChangePassword: true,
        permissions: {
          create: dbPermissions.map(p => ({
            permissionId: p.id,
            grantedById: user.id,
          })),
        },
        classAssignments: {
          create: input.classIds?.map(cId => ({ classId: cId })) || [],
        },
        subjectAssignments: {
          create: input.subjectIds?.map(sId => ({ subjectId: sId })) || [],
        },
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.USER_CREATED,
      actor: user,
      targetType: 'user',
      targetId: newAdmin.id,
      description: `Created new admin: ${input.fullName}`,
    });

    revalidatePath('/manage/admins');
    return actionSuccess(null, 'Administrator created successfully.');
  });
}

export async function updateAdminSettingsAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requirePermission(user, PERMISSIONS.MANAGE_ADMINS);

    // parse form arrays manually
    const allFormData = new FormData();
    for (const [key, value] of formData.entries()) {
      allFormData.append(key, value);
    }
    const permissions = allFormData.getAll('permissions').map(String);
    const classIds = allFormData.getAll('classIds').map(String);
    const subjectIds = allFormData.getAll('subjectIds').map(String);

    const rawData = Object.fromEntries(formData.entries());
    rawData.permissions = permissions as any;
    rawData.classIds = classIds as any;
    rawData.subjectIds = subjectIds as any;

    const permInput = updateAdminPermissionsSchema.parse(rawData);
    const assignInput = updateAdminAssignmentsSchema.parse(rawData);
    
    const admin = await prisma.user.findUnique({ where: { id: permInput.userId } });
    if (!admin) throw new Error('Administrator not found');

    const dbPermissions = await prisma.permission.findMany({
      where: { key: { in: permInput.permissions } },
    });

    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId: admin.id } }),
      prisma.userPermission.createMany({
        data: dbPermissions.map(p => ({
          userId: admin.id,
          permissionId: p.id,
          grantedById: user.id,
        })),
      }),
      prisma.adminClassAssignment.deleteMany({ where: { userId: admin.id } }),
      prisma.adminClassAssignment.createMany({
        data: assignInput.classIds?.map(classId => ({ userId: admin.id, classId })) || [],
      }),
      prisma.adminSubjectAssignment.deleteMany({ where: { userId: admin.id } }),
      prisma.adminSubjectAssignment.createMany({
        data: assignInput.subjectIds?.map(subjectId => ({ userId: admin.id, subjectId })) || [],
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      actor: user,
      targetType: 'user',
      targetId: admin.id,
      description: `Updated administrator permissions & assignments: ${admin.fullName}`,
    });

    revalidatePath('/manage/admins');
    return actionSuccess(null, 'Administrator settings updated successfully.');
  });
}
