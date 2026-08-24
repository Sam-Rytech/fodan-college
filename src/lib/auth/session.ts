import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { prisma } from '../db';
import { env } from '../env';
import { hmacToken, hmacTokenCandidates, randomToken } from '../crypto';
import { addMinutes } from '../utils';
import {
  PERMISSION_KEYS,
  ROLES,
  type PermissionKey,
  type RoleKey,
  type StudentType,
  type UserStatus,
  USER_STATUS,
} from '../constants';
import type { AuthUser, RequestContext, SessionContext } from './types';

/**
 * Session management.
 *
 * Design: opaque server-side sessions rather than self-contained JWTs.
 *  - Revocation is immediate and complete. Disabling an account, resetting a
 *    password or logging out everywhere takes effect on the very next request,
 *    which a stateless token cannot guarantee without a blocklist anyway.
 *  - The cookie value is 256 bits of CSPRNG output and is never a bearer of
 *    claims, so nothing can be forged by tampering.
 *  - Only the HMAC of the token is stored, keyed by AUTH_SECRET, so a leaked
 *    database dump cannot be replayed as a valid session.
 *
 * Two independent expiries are enforced on every read:
 *  - absolute (`expiresAt`), fixed at creation;
 *  - idle (`lastSeenAt` + SESSION_IDLE_TIMEOUT_MINUTES).
 */

const SESSION_COOKIE = env.session.cookieName;

/** How stale lastSeenAt may get before we pay for a write. */
const TOUCH_INTERVAL_MS = 60_000;

export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    headerList.get('x-real-ip') ||
    headerList.get('cf-connecting-ip') ||
    null;

  return {
    ipAddress: env.auditRecordIp ? ip : null,
    userAgent: headerList.get('user-agent')?.slice(0, 400) ?? null,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const context = await getRequestContext();
  const now = new Date();

  await prisma.session.create({
    data: {
      tokenHash: hmacToken(token, 'session'),
      userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: addMinutes(now, env.session.absoluteTimeoutMinutes),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: env.session.absoluteTimeoutMinutes * 60,
  });

  return token;
}

export async function destroyCurrentSession(reason = 'logout'): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: { in: hmacTokenCandidates(token, 'session') } },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Ends every session for a user. Used on password change and account disable. */
export async function revokeAllSessions(
  userId: string,
  reason: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

interface LoadedSession {
  session: SessionContext;
  user: AuthUser;
}

/**
 * Resolves the current session and principal.
 *
 * Wrapped in React `cache` so a single request that touches auth in a layout, a
 * page and three server components still performs exactly one database read.
 */
export const loadSession = cache(async (): Promise<LoadedSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const record = await prisma.session.findFirst({
    where: { tokenHash: { in: hmacTokenCandidates(token, 'session') } },
    include: {
      user: {
        include: {
          role: true,
          permissions: { include: { permission: true } },
          studentProfile: { include: { schoolClass: true } },
          classAssignments: { select: { classId: true } },
          subjectAssignments: { select: { subjectId: true } },
        },
      },
    },
  });

  if (!record) return null;

  const now = Date.now();
  const idleDeadline =
    record.lastSeenAt.getTime() + env.session.idleTimeoutMinutes * 60_000;

  const invalid =
    record.revokedAt !== null ||
    record.expiresAt.getTime() <= now ||
    idleDeadline <= now ||
    record.user.status !== USER_STATUS.ACTIVE;

  if (invalid) {
    // Best-effort cleanup; a revoked row is harmless if the write races.
    if (record.revokedAt === null) {
      await prisma.session
        .update({
          where: { id: record.id },
          data: {
            revokedAt: new Date(),
            revokedReason:
              record.user.status !== USER_STATUS.ACTIVE
                ? 'account_disabled'
                : 'expired',
          },
        })
        .catch(() => undefined);
    }
    return null;
  }

  if (now - record.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session
      .update({ where: { id: record.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  const user = record.user;
  const roleKey = user.role as RoleKey;

  return {
    session: {
      sessionId: record.id,
      expiresAt: record.expiresAt,
      lastSeenAt: record.lastSeenAt,
    },
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: roleKey,
      status: user.status as UserStatus,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      permissions: await resolvePermissions(
        roleKey,
        user.roleId,
        user.permissions.map((p) => ({
          key: p.permission.key as PermissionKey,
          granted: p.granted,
        })),
      ),
      student: user.studentProfile
        ? {
            profileId: user.studentProfile.id,
            classId: user.studentProfile.classId,
            className: user.studentProfile.schoolClass?.name ?? null,
            classSlug: user.studentProfile.schoolClass?.slug ?? null,
            studentType: user.studentProfile.studentType as StudentType,
            isActivated: user.studentProfile.isActivated,
            activatedAt: user.studentProfile.activatedAt?.toISOString() ?? null,
            admissionNumber: user.studentProfile.admissionNumber,
          }
        : null,
      assignedClassIds: user.classAssignments.map((a) => a.classId),
      assignedSubjectIds: user.subjectAssignments.map((a) => a.subjectId),
      forumSuspendedUntil: user.forumSuspendedUntil?.toISOString() ?? null,
    },
  };
});

/**
 * Effective permission set = role defaults ∪ explicit grants ∖ explicit denies.
 * A Super Admin short-circuits to the full set so a newly added permission is
 * never missing from the bootstrap account.
 */
const roleDefaults = cache(async (roleId: string): Promise<PermissionKey[]> => {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: { select: { key: true } } },
  });
  return rows.map((row) => row.permission.key as PermissionKey);
});

async function resolvePermissions(
  roleKey: RoleKey,
  roleId: string,
  overrides: { key: PermissionKey; granted: boolean }[],
): Promise<PermissionKey[]> {
  if (roleKey === ROLES.SUPER_ADMIN) return [...PERMISSION_KEYS];

  const effective = new Set<PermissionKey>(await roleDefaults(roleId));
  for (const override of overrides) {
    if (override.granted) effective.add(override.key);
    else effective.delete(override.key);
  }
  return [...effective];
}

/** Current principal, or null when unauthenticated. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const loaded = await loadSession();
  return loaded?.user ?? null;
}

export async function getCurrentSession(): Promise<SessionContext | null> {
  const loaded = await loadSession();
  return loaded?.session ?? null;
}

/** Housekeeping: drop sessions that have been expired or revoked for a week. */
export async function pruneStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}
