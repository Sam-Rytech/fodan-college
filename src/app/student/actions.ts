'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import {
  progressUpdateSchema,
  redeemCodeSchema,
  selectClassSchema,
  updateProfileSchema,
} from '@/lib/validation';
import { requireActivatedStudent, requireStudent, requireUser } from '@/lib/auth/guards';
import { redeemAccessCode } from '@/lib/access-codes';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { markAllRead, markRead } from '@/lib/notifications';
import { AppError, notFound } from '@/lib/errors';
import {
  AUDIT_ACTIONS,
  LESSON_PROGRESS_STATUS,
  PUBLISH_STATUS,
} from '@/lib/constants';

/** Server actions available to a signed-in student. */

// -----------------------------------------------------------------------------
// Class selection
// -----------------------------------------------------------------------------

export async function selectClassAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireStudent();
    const input = parseForm(selectClassSchema, formData);

    // Once activated, the class is fixed: it determines which examination
    // papers the student may sit, so changing it must go through staff.
    if (user.student?.isActivated && user.student.classId) {
      throw new AppError(
        'FORBIDDEN',
        'Your class has already been set. Ask your teacher if it needs to change.',
      );
    }

    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: input.classId, isActive: true },
    });
    if (!schoolClass) {
      throw new AppError('VALIDATION', 'Choose a class from the list.');
    }

    await prisma.studentProfile.update({
      where: { userId: user.id },
      data: { classId: schoolClass.id, studentType: schoolClass.level },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.USER_UPDATED,
      actor: user,
      targetType: 'student',
      targetId: user.id,
      description: `${user.fullName} joined ${schoolClass.name}.`,
      metadata: { classId: schoolClass.id },
    });

    return actionSuccess(null);
  });

  if (!result.ok) return result;

  revalidatePath('/student', 'layout');
  redirect('/student/activate');
}

// -----------------------------------------------------------------------------
// Activation
// -----------------------------------------------------------------------------

export async function activateAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireStudent();

    if (user.student?.isActivated) {
      return actionSuccess(null, 'Your account is already active.');
    }

    // Redemption is rate-limited per account: the code space is far too large
    // to brute force, but this closes the door completely.
    await enforceRateLimit(
      RATE_LIMITS.activationCode,
      user.id,
      'Too many attempts. Wait a few minutes, then check the code with your teacher.',
    );

    const input = parseForm(redeemCodeSchema, formData);
    await redeemAccessCode(input.code, user);

    return actionSuccess(null);
  });

  if (!result.ok) return result;

  revalidatePath('/student', 'layout');
  redirect('/student?activated=1');
}

// -----------------------------------------------------------------------------
// Lesson progress
// -----------------------------------------------------------------------------

export async function updateProgressAction(
  formData: FormData,
): Promise<ActionResult<{ status: string; progressPercent: number }>> {
  return runAction(async () => {
    const user = await requireActivatedStudent();
    const input = parseForm(progressUpdateSchema, formData);

    // The material must be published AND belong to the student's own class.
    const material = await prisma.learningMaterial.findFirst({
      where: {
        id: input.materialId,
        classId: user.student?.classId ?? '',
        status: PUBLISH_STATUS.PUBLISHED,
      },
      select: { id: true },
    });
    if (!material) throw notFound('That lesson is not available.');

    const status = input.completed
      ? LESSON_PROGRESS_STATUS.COMPLETED
      : LESSON_PROGRESS_STATUS.IN_PROGRESS;
    const progressPercent = input.completed ? 100 : input.progressPercent;

    await prisma.lessonProgress.upsert({
      where: {
        studentId_materialId: { studentId: user.id, materialId: material.id },
      },
      create: {
        studentId: user.id,
        materialId: material.id,
        status,
        progressPercent,
        lastPositionSeconds: input.lastPositionSeconds,
        completedAt: input.completed ? new Date() : null,
      },
      update: {
        status,
        // Progress only moves forward, so a fresh page load that reports 0%
        // cannot wipe out what the student has already watched.
        progressPercent: input.completed ? 100 : undefined,
        lastPositionSeconds: input.lastPositionSeconds,
        completedAt: input.completed ? new Date() : null,
      },
    });

    if (input.completed) {
      revalidatePath('/student');
      revalidatePath('/student/subjects');
    }

    return actionSuccess({ status, progressPercent });
  });
}

/** Lightweight position ping from the video/audio players. */
export async function saveMediaPositionAction(
  materialId: string,
  seconds: number,
  percent: number,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireActivatedStudent();

    const material = await prisma.learningMaterial.findFirst({
      where: {
        id: materialId,
        classId: user.student?.classId ?? '',
        status: PUBLISH_STATUS.PUBLISHED,
      },
      select: { id: true },
    });
    if (!material) throw notFound('That lesson is not available.');

    const safeSeconds = Math.max(0, Math.min(86_400, Math.floor(seconds)));
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

    await prisma.lessonProgress.upsert({
      where: {
        studentId_materialId: { studentId: user.id, materialId },
      },
      create: {
        studentId: user.id,
        materialId,
        status: LESSON_PROGRESS_STATUS.IN_PROGRESS,
        progressPercent: safePercent,
        lastPositionSeconds: safeSeconds,
      },
      update: {
        lastPositionSeconds: safeSeconds,
        progressPercent: safePercent,
      },
    });

    return actionSuccess(null);
  });
}

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

export async function updateOwnProfileAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireUser();
    const input = parseForm(updateProfileSchema, formData);

    // A student cannot change their own username, role, class or activation —
    // only the details that are genuinely theirs to correct.
    const clash = await prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          ...(input.phone ? [{ phone: input.phone }] : []),
        ],
      },
      select: { email: true, phone: true },
    });

    if (clash) {
      throw new AppError(
        'CONFLICT',
        clash.email === input.email
          ? 'Another account already uses that email address.'
          : 'Another account already uses that phone number.',
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        // Changing the address invalidates any previous verification.
        ...(input.email !== user.email ? { emailVerifiedAt: null } : {}),
        ...(input.phone !== user.phone ? { phoneVerifiedAt: null } : {}),
      },
    });

    if (user.student) {
      await prisma.studentProfile.update({
        where: { userId: user.id },
        data: {
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
        },
      });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.USER_UPDATED,
      actor: user,
      targetType: 'user',
      targetId: user.id,
      description: `${user.fullName} updated their own profile.`,
    });

    revalidatePath('/student', 'layout');
    revalidatePath('/manage', 'layout');

    return actionSuccess(null, 'Your profile has been saved.');
  });
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export async function markNotificationsReadAction(
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireUser();
    const notificationId = formData.get('notificationId');
    const all = formData.get('all') === 'true';

    if (all) {
      await markAllRead(user.id);
    } else if (typeof notificationId === 'string' && notificationId) {
      await markRead(user.id, notificationId);
    }

    revalidatePath('/student', 'layout');
    revalidatePath('/manage', 'layout');

    return actionSuccess(null);
  });
}
