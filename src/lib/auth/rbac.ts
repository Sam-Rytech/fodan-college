import {
  DELEGATABLE_PERMISSIONS,
  PERMISSIONS,
  ROLES,
  type PermissionKey,
  type RoleKey,
} from '../constants';
import type { AuthUser } from './types';

/**
 * Authorisation rules.
 *
 * Every rule lives here rather than being re-derived at call sites, so there is
 * exactly one definition of "may this person do this thing". Server actions,
 * route handlers and page loaders all funnel through these helpers; the UI uses
 * the same functions purely to decide what to *show*, never as the enforcement
 * point.
 *
 * These functions are pure and importable from client components.
 */

export function isSuperAdmin(user: Pick<AuthUser, 'role'> | null): boolean {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isStaff(user: Pick<AuthUser, 'role'> | null): boolean {
  return user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.MINI_ADMIN;
}

export function isStudent(user: Pick<AuthUser, 'role'> | null): boolean {
  return user?.role === ROLES.STUDENT;
}

/**
 * The Super Admin implicitly holds every permission — including ones that are
 * never delegatable — so new permissions do not have to be back-filled onto the
 * bootstrap account whenever the platform grows a feature.
 */
export function hasPermission(
  user: Pick<AuthUser, 'role' | 'permissions'> | null,
  permission: PermissionKey,
): boolean {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.permissions.includes(permission);
}

export function hasAnyPermission(
  user: Pick<AuthUser, 'role' | 'permissions'> | null,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasAllPermissions(
  user: Pick<AuthUser, 'role' | 'permissions'> | null,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.every((permission) => hasPermission(user, permission));
}

/** Permissions that may be granted to a Mini Admin at all. */
export function isDelegatable(permission: PermissionKey): boolean {
  return DELEGATABLE_PERMISSIONS.includes(permission);
}

// -----------------------------------------------------------------------------
// Scoping: which classes and subjects a staff member may act on
// -----------------------------------------------------------------------------

/**
 * A Mini Admin with no explicit class assignment is scoped to nothing, not to
 * everything. Fail closed: an unassigned admin should see an empty workspace,
 * not the whole school.
 */
export function canAccessClass(
  user: Pick<AuthUser, 'role' | 'assignedClassIds' | 'student'> | null,
  classId: string | null | undefined,
): boolean {
  if (!user || !classId) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.role === ROLES.MINI_ADMIN) return user.assignedClassIds.includes(classId);
  return user.student?.classId === classId;
}

export function canAccessSubject(
  user: Pick<AuthUser, 'role' | 'assignedSubjectIds'> | null,
  subjectId: string | null | undefined,
): boolean {
  if (!user || !subjectId) return false;
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.role === ROLES.MINI_ADMIN) {
    return user.assignedSubjectIds.includes(subjectId);
  }
  // Students reach subjects through their class, checked separately.
  return true;
}

/**
 * Prisma `where` fragment that limits a query to the classes a staff member may
 * see. Returning `{}` for a Super Admin keeps call sites free of branching.
 */
export function classScopeFilter(
  user: Pick<AuthUser, 'role' | 'assignedClassIds'>,
): { classId?: { in: string[] } } {
  if (user.role === ROLES.SUPER_ADMIN) return {};
  return { classId: { in: user.assignedClassIds } };
}

export function subjectScopeFilter(
  user: Pick<AuthUser, 'role' | 'assignedSubjectIds'>,
): { subjectId?: { in: string[] } } {
  if (user.role === ROLES.SUPER_ADMIN) return {};
  return { subjectId: { in: user.assignedSubjectIds } };
}

// -----------------------------------------------------------------------------
// Learning access
// -----------------------------------------------------------------------------

/**
 * A student may only open lessons and examinations once their account has been
 * activated with an access code. Staff always have read access for review.
 */
export function canStudyContent(user: AuthUser | null): boolean {
  if (!user) return false;
  if (isStaff(user)) return true;
  return Boolean(user.student?.isActivated && user.student.classId);
}

export function needsActivation(user: AuthUser | null): boolean {
  return Boolean(user && isStudent(user) && !user.student?.isActivated);
}

export function needsClassSelection(user: AuthUser | null): boolean {
  return Boolean(user && isStudent(user) && !user.student?.classId);
}

// -----------------------------------------------------------------------------
// Privacy rules between administrators
// -----------------------------------------------------------------------------

/**
 * A Mini Admin must never inspect another administrator's record. They may read
 * their own, and the Super Admin may read anyone's. Student records are governed
 * by manage_students plus class scoping, not by this rule.
 */
export function canViewAdminProfile(
  viewer: Pick<AuthUser, 'id' | 'role' | 'permissions'> | null,
  targetUserId: string,
  targetRole: RoleKey,
): boolean {
  if (!viewer) return false;
  if (viewer.id === targetUserId) return true;
  if (viewer.role === ROLES.SUPER_ADMIN) return true;
  if (targetRole === ROLES.STUDENT) {
    return hasPermission(viewer, PERMISSIONS.MANAGE_STUDENTS);
  }
  // Mini Admin looking at another administrator: never.
  return false;
}

/**
 * Only the Super Admin may modify an administrator account, and no account may
 * change its own role — that would let a Mini Admin escalate to Super Admin.
 */
export function canModifyUser(
  actor: Pick<AuthUser, 'id' | 'role'> | null,
  target: { id: string; role: RoleKey },
): boolean {
  if (!actor) return false;
  if (actor.id === target.id) return false;
  if (target.role === ROLES.SUPER_ADMIN) return false;
  if (target.role === ROLES.MINI_ADMIN) return actor.role === ROLES.SUPER_ADMIN;
  return (
    actor.role === ROLES.SUPER_ADMIN ||
    (actor.role === ROLES.MINI_ADMIN &&
      hasPermission(actor as AuthUser, PERMISSIONS.MANAGE_STUDENTS))
  );
}

/** Nobody may create a second Super Admin through the application. */
export function canCreateRole(
  actor: Pick<AuthUser, 'role'> | null,
  role: RoleKey,
): boolean {
  if (!actor) return false;
  if (role === ROLES.SUPER_ADMIN) return false;
  if (role === ROLES.MINI_ADMIN) return actor.role === ROLES.SUPER_ADMIN;
  return isStaff(actor);
}

// -----------------------------------------------------------------------------
// Forum rules
// -----------------------------------------------------------------------------

export function isForumSuspended(user: AuthUser | null): boolean {
  if (!user?.forumSuspendedUntil) return false;
  return new Date(user.forumSuspendedUntil).getTime() > Date.now();
}

export function canModerateForum(user: AuthUser | null): boolean {
  return hasPermission(user, PERMISSIONS.MANAGE_FORUM);
}
