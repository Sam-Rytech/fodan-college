'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validation';
import {
  changeOwnPassword,
  completePasswordReset,
  login,
  registerStudent,
  requestPasswordReset,
} from '@/lib/auth/service';
import { destroyCurrentSession, getCurrentSession } from '@/lib/auth/session';
import { requireUser } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS, ROLES, type StudentType } from '@/lib/constants';

/**
 * Authentication server actions.
 *
 * Each one returns an ActionResult on failure and redirects on success —
 * a redirect is thrown by Next, so `runAction` is careful to let it through
 * rather than converting it into an error envelope.
 */

export async function loginAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  let destination = '/';

  const result = await runAction(async () => {
    const input = parseForm(loginSchema, formData);
    const outcome = await login(input.identifier, input.password);

    if (outcome.mustChangePassword) {
      destination = '/change-password';
    } else if (input.next) {
      destination = input.next;
    } else if (outcome.role === ROLES.STUDENT) {
      destination = '/student';
    } else {
      destination = '/manage';
    }

    return actionSuccess(null);
  });

  if (!result.ok) return result;

  redirect(destination);
}

export async function registerAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const input = parseForm(registerSchema, formData);

    await registerStudent({
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      phone: input.phone,
      password: input.password,
      classId: input.classId,
      studentType: input.studentType as StudentType,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
    });

    return actionSuccess(null);
  });

  if (!result.ok) return result;

  // A newly registered student always lands on activation — that is the next
  // real step, and sending them to an empty dashboard would only confuse.
  redirect('/student/activate');
}

export async function logoutAction(): Promise<void> {
  const user = await requireUser().catch(() => null);

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      actor: user,
      targetType: 'user',
      targetId: user.id,
      description: `${user.fullName} signed out.`,
    });
  }

  await destroyCurrentSession('logout');
  redirect('/login');
}

export async function changePasswordAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const user = await requireUser();
    const input = parseForm(changePasswordSchema, formData);
    const session = await getCurrentSession();

    await changeOwnPassword(
      user,
      input.currentPassword,
      input.newPassword,
      session?.sessionId,
    );

    return actionSuccess(null);
  });

  if (!result.ok) return result;

  revalidatePath('/', 'layout');

  const user = await requireUser().catch(() => null);
  redirect(user?.role === ROLES.STUDENT ? '/student' : '/manage');
}

export async function forgotPasswordAction(
  _previous: ActionResult<{ devToken?: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ devToken?: string }>> {
  return runAction(async () => {
    const input = parseForm(forgotPasswordSchema, formData);
    const outcome = await requestPasswordReset(input.identifier);

    // Deliberately identical whether or not the account exists.
    return actionSuccess(
      outcome,
      'If that account exists, a reset link has been prepared. Check your email, or ask your school administrator for it.',
    );
  });
}

export async function resetPasswordAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const result = await runAction(async () => {
    const input = parseForm(resetPasswordSchema, formData);
    await completePasswordReset(input.token, input.newPassword);
    return actionSuccess(null);
  });

  if (!result.ok) return result;

  redirect('/login?reset=done');
}
