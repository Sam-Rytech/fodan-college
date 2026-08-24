import type { PermissionKey, RoleKey, StudentType, UserStatus } from '../constants';

/**
 * The authenticated principal, assembled once per request.
 *
 * Deliberately excludes passwordHash, session tokens and every other secret so
 * that it is safe to pass wholesale into a server component tree. Anything
 * added here must remain safe to serialise to the browser.
 */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: RoleKey;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;

  /** Effective permissions: role defaults, plus per-user grants, minus per-user denies. */
  permissions: PermissionKey[];

  /** Present only for accounts whose role is STUDENT. */
  student: StudentContext | null;

  /** Scoping for Mini Admins. Empty arrays mean "no explicit assignment". */
  assignedClassIds: string[];
  assignedSubjectIds: string[];

  forumSuspendedUntil: string | null;
}

export interface StudentContext {
  profileId: string;
  classId: string | null;
  className: string | null;
  classSlug: string | null;
  studentType: StudentType;
  isActivated: boolean;
  activatedAt: string | null;
  admissionNumber: string | null;
}

export interface SessionContext {
  sessionId: string;
  expiresAt: Date;
  lastSeenAt: Date;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}
