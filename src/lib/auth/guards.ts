import 'server-only';
import { redirect } from 'next/navigation';
import { PERMISSIONS, ROLES, type PermissionKey, type RoleKey } from '../constants';
import { forbidden, unauthenticated } from '../errors';
import { getCurrentUser } from './session';
import {
  canStudyContent,
  hasAnyPermission,
  hasPermission,
  isStaff,
  needsActivation,
} from './rbac';
import type { AuthUser } from './types';

/**
 * Server-side authorisation guards.
 *
 * Two flavours, deliberately kept separate:
 *  - `require*` throws an AppError. Use inside server actions and route
 *    handlers, where the caller wants a structured failure to return.
 *  - `guard*` redirects. Use at the top of a page/layout, where the right
 *    response is to send the visitor somewhere they are allowed to be.
 *
 * Every protected surface calls one of these. Hiding a nav item is presentation,
 * never protection.
 */

// -----------------------------------------------------------------------------
// Throwing variants — server actions & route handlers
// -----------------------------------------------------------------------------

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export async function requireRole(...roles: RoleKey[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw forbidden('This area is not available to your account.');
  }
  return user;
}

export async function requireStaff(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isStaff(user)) {
    throw forbidden('This area is for administrators only.');
  }
  return user;
}

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== ROLES.SUPER_ADMIN) {
    throw forbidden('Only the Super Admin can do that.');
  }
  return user;
}

export async function requirePermission(
  permission: PermissionKey,
): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) {
    throw forbidden('You do not have permission to do that.');
  }
  return user;
}

export async function requireAnyPermission(
  ...permissions: PermissionKey[]
): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasAnyPermission(user, permissions)) {
    throw forbidden('You do not have permission to do that.');
  }
  return user;
}

export async function requireStudent(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== ROLES.STUDENT) {
    throw forbidden('This action is only available to students.');
  }
  return user;
}

/** Student who has completed activation — the gate on all learning content. */
export async function requireActivatedStudent(): Promise<AuthUser> {
  const user = await requireStudent();
  if (!user.student?.classId) {
    throw forbidden('Choose your class before continuing.');
  }
  if (!user.student.isActivated) {
    throw forbidden(
      'Your account is waiting for activation. Enter your access code to unlock your lessons.',
    );
  }
  return user;
}

// -----------------------------------------------------------------------------
// Redirecting variants — pages & layouts
// -----------------------------------------------------------------------------

/**
 * Where a signed-in account belongs when it lands on a bare route.
 *
 * Both administrator roles share the `/manage` area rather than living in two
 * parallel route trees: the Mini Admin experience is the Super Admin one with
 * sections removed by permission, and maintaining a second copy of every screen
 * would guarantee the two drift apart. Each section still guards itself.
 */
export function homePathFor(user: AuthUser): string {
  if (user.mustChangePassword) return '/change-password';
  switch (user.role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.MINI_ADMIN:
      return '/manage';
    default:
      return '/student';
  }
}

export async function guardUser(returnTo?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login');
  }
  // A forced password change blocks every other authenticated surface.
  if (user.mustChangePassword) {
    redirect('/change-password');
  }
  return user;
}

export async function guardStaff(returnTo?: string): Promise<AuthUser> {
  const user = await guardUser(returnTo);
  if (!isStaff(user)) redirect('/student');
  return user;
}

export async function guardSuperAdmin(returnTo?: string): Promise<AuthUser> {
  const user = await guardUser(returnTo);
  if (user.role !== ROLES.SUPER_ADMIN) redirect(homePathFor(user));
  return user;
}

export async function guardPermission(
  permission: PermissionKey,
  returnTo?: string,
): Promise<AuthUser> {
  const user = await guardUser(returnTo);
  if (!hasPermission(user, permission)) redirect(homePathFor(user));
  return user;
}

export async function guardStudent(returnTo?: string): Promise<AuthUser> {
  const user = await guardUser(returnTo);
  if (user.role !== ROLES.STUDENT) redirect(homePathFor(user));
  return user;
}

/**
 * Learning-content pages. Sends an unactivated student to the activation screen
 * rather than showing an error, because activation is a normal step in the
 * student journey, not a failure.
 */
export async function guardLearningAccess(returnTo?: string): Promise<AuthUser> {
  const user = await guardUser(returnTo);
  if (isStaff(user)) return user;
  if (user.role !== ROLES.STUDENT) redirect(homePathFor(user));
  if (!user.student?.classId) redirect('/student/select-class');
  if (needsActivation(user)) redirect('/student/activate');
  if (!canStudyContent(user)) redirect('/student');
  return user;
}

/** Convenience for nav rendering: the permissions each admin section needs. */
export const SECTION_PERMISSIONS = {
  students: [PERMISSIONS.MANAGE_STUDENTS],
  admins: [PERMISSIONS.MANAGE_ADMINS],
  classes: [PERMISSIONS.MANAGE_CLASSES],
  subjects: [PERMISSIONS.MANAGE_SUBJECTS],
  materials: [PERMISSIONS.UPLOAD_MATERIALS],
  examinations: [PERMISSIONS.MANAGE_EXAMS],
  results: [PERMISSIONS.VIEW_RESULTS],
  codes: [PERMISSIONS.MANAGE_CODES],
  tasks: [PERMISSIONS.MANAGE_TASKS],
  forum: [PERMISSIONS.MANAGE_FORUM],
  audit: [PERMISSIONS.VIEW_AUDIT_LOGS],
  settings: [PERMISSIONS.MANAGE_SETTINGS],
} as const satisfies Record<string, readonly PermissionKey[]>;
