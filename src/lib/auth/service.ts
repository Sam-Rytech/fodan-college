import 'server-only';
import { prisma } from '../db';
import { env } from '../env';
import { AppError, conflict, notFound } from '../errors';
import {
  burnPasswordComparison,
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
} from '../password';
import { hmacToken, hmacTokenCandidates, randomToken } from '../crypto';
import { recordAudit } from '../audit';
import { notify } from '../notifications';
import { enforceRateLimit, RATE_LIMITS, resetRateLimit } from '../rate-limit';
import { getBooleanSetting } from '../settings';
import { normalisePhone } from '../validation';
import { addMinutes } from '../utils';
import {
  AUDIT_ACTIONS,
  AUDIT_SEVERITY,
  NOTIFICATION_TYPES,
  ROLES,
  SETTING_KEYS,
  USER_STATUS,
  type RoleKey,
  type StudentType,
} from '../constants';
import { createSession, getRequestContext, revokeAllSessions } from './session';
import type { AuthUser } from './types';

/**
 * Authentication use-cases: sign in, register, change password, reset password.
 *
 * Threat model addressed here:
 *  - CREDENTIAL STUFFING — per-identifier and per-IP rate limits, plus a
 *    per-account lockout that survives IP rotation.
 *  - USER ENUMERATION — one message for every failed sign-in, a dummy bcrypt
 *    comparison when the account does not exist so timing does not differ, and
 *    a password-reset request that answers identically whether or not the
 *    account exists.
 *  - SESSION FIXATION — a session is always created fresh after authentication;
 *    no pre-login session is ever elevated.
 *  - STALE SESSIONS — changing or resetting a password revokes every other
 *    session for that account.
 */

const GENERIC_LOGIN_FAILURE =
  'That username or password is not correct. Please try again.';

// -----------------------------------------------------------------------------
// Sign in
// -----------------------------------------------------------------------------

export interface LoginResult {
  user: AuthUser;
  mustChangePassword: boolean;
}

export async function login(
  identifier: string,
  password: string,
): Promise<{ userId: string; role: RoleKey; mustChangePassword: boolean }> {
  const context = await getRequestContext();
  const normalisedIdentifier = identifier.trim().toLowerCase();

  // Two independent buckets: one stops a single account being hammered from
  // many addresses, the other stops one address hammering many accounts.
  await enforceRateLimit(RATE_LIMITS.login, `id:${normalisedIdentifier}`);
  if (context.ipAddress) {
    await enforceRateLimit(RATE_LIMITS.login, `ip:${context.ipAddress}`);
  }

  const user = await findByIdentifier(identifier);

  if (!user) {
    await burnPasswordComparison(password);
    await recordFailure(null, identifier, 'unknown_identifier', context);
    throw new AppError('UNAUTHENTICATED', GENERIC_LOGIN_FAILURE);
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordFailure(user.id, identifier, 'locked', context);
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Too many failed attempts. This account is locked for another ${minutes} minute${
        minutes === 1 ? '' : 's'
      }.`,
    );
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    const failures = user.failedLoginCount + 1;
    const shouldLock = failures >= env.login.maxAttempts;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failures,
        lockedUntil: shouldLock
          ? addMinutes(new Date(), env.login.lockoutMinutes)
          : null,
      },
    });

    await recordFailure(user.id, identifier, 'bad_password', context);

    if (shouldLock) {
      await recordAudit({
        action: AUDIT_ACTIONS.ACCOUNT_LOCKED,
        actor: { id: user.id, username: user.username, role: user.role.key as RoleKey },
        targetType: 'user',
        targetId: user.id,
        description: `Account locked after ${failures} failed sign-in attempts.`,
        severity: AUDIT_SEVERITY.WARNING,
      });

      await notify({
        userId: user.id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        title: 'Your account was locked',
        body: `There were ${failures} failed sign-in attempts. The lock lifts automatically after ${env.login.lockoutMinutes} minutes.`,
      });
    }

    throw new AppError('UNAUTHENTICATED', GENERIC_LOGIN_FAILURE);
  }

  // A disabled account is checked only AFTER the password verifies, so the
  // sign-in form cannot be used to discover which usernames exist.
  if (user.status !== USER_STATUS.ACTIVE) {
    await recordFailure(user.id, identifier, 'disabled', context);
    throw new AppError(
      'FORBIDDEN',
      'This account has been disabled. Please speak to your school administrator.',
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: context.ipAddress,
    },
  });

  await prisma.loginAttempt.create({
    data: {
      identifier: identifier.slice(0, 150),
      userId: user.id,
      success: true,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  await createSession(user.id);
  await resetRateLimit(RATE_LIMITS.login, `id:${normalisedIdentifier}`);

  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    actor: { id: user.id, username: user.username, role: user.role.key as RoleKey },
    targetType: 'user',
    targetId: user.id,
    description: `${user.fullName} signed in.`,
  });

  return {
    userId: user.id,
    role: user.role.key as RoleKey,
    mustChangePassword: user.mustChangePassword,
  };
}

async function findByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const lowered = trimmed.toLowerCase();
  const phone = normalisePhone(trimmed);

  return prisma.user.findFirst({
    where: {
      OR: [
        { username: trimmed },
        { username: lowered },
        { email: lowered },
        ...(phone ? [{ phone }] : []),
      ],
    },
    include: { role: true },
  });
}

async function recordFailure(
  userId: string | null,
  identifier: string,
  reason: string,
  context: { ipAddress: string | null; userAgent: string | null },
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      identifier: identifier.slice(0, 150),
      userId,
      success: false,
      reason,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN_FAILED,
    targetType: 'user',
    targetId: userId ?? undefined,
    description: `Failed sign-in for "${identifier.slice(0, 60)}" (${reason}).`,
    severity: AUDIT_SEVERITY.WARNING,
    metadata: { reason },
  });
}

// -----------------------------------------------------------------------------
// Registration
// -----------------------------------------------------------------------------

export interface RegisterInput {
  fullName: string;
  username: string;
  email: string | null;
  phone: string | null;
  password: string;
  classId: string | null;
  studentType: StudentType;
  guardianName: string | null;
  guardianPhone: string | null;
}

export async function registerStudent(input: RegisterInput): Promise<string> {
  const context = await getRequestContext();
  await enforceRateLimit(
    RATE_LIMITS.register,
    context.ipAddress ?? 'unknown',
    'Too many accounts have been created from this device. Please try again later.',
  );

  if (!(await getBooleanSetting(SETTING_KEYS.ALLOW_REGISTRATION))) {
    throw new AppError(
      'FORBIDDEN',
      'Registration is currently closed. Please ask your school for an account.',
    );
  }

  const policy = checkPasswordPolicy(input.password, {
    username: input.username,
    fullName: input.fullName,
    email: input.email,
  });
  if (!policy.ok) {
    throw new AppError('VALIDATION', policy.problems[0] as string, {
      details: { password: policy.problems },
    });
  }

  await assertIdentityAvailable(input.username, input.email, input.phone);

  if (input.classId) {
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: input.classId, isActive: true },
    });
    if (!schoolClass) {
      throw new AppError('VALIDATION', 'Choose a class from the list.', {
        details: { classId: ['Choose a class from the list.'] },
      });
    }
  }

  const studentRole = await prisma.role.findUnique({ where: { key: ROLES.STUDENT } });
  if (!studentRole) {
    throw new AppError('INTERNAL', 'The platform is not fully set up yet.', {
      internal: 'STUDENT role missing — run the seed script.',
    });
  }

  const user = await prisma.user.create({
    data: {
      username: input.username,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      roleId: studentRole.id,
      status: USER_STATUS.ACTIVE,
      passwordChangedAt: new Date(),
      studentProfile: {
        create: {
          classId: input.classId,
          studentType: input.studentType,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          // Registration never grants learning access. Only a redeemed
          // activation code (or a Super Admin) sets isActivated.
          isActivated: false,
        },
      },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.USER_REGISTERED,
    actor: { id: user.id, username: user.username, role: ROLES.STUDENT },
    targetType: 'user',
    targetId: user.id,
    description: `${user.fullName} registered as a student.`,
    metadata: { classId: input.classId, studentType: input.studentType },
  });

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: `Welcome to Fodan College, ${input.fullName.split(' ')[0]}`,
    body: 'Your account is waiting for activation. Enter the access code from your school to unlock your lessons.',
    link: '/student/activate',
  });

  await createSession(user.id);
  return user.id;
}

export async function assertIdentityAvailable(
  username: string,
  email: string | null,
  phone: string | null,
  excludeUserId?: string,
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: {
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: [
        { username },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: { username: true, email: true, phone: true },
  });

  if (!existing) return;

  if (existing.username.toLowerCase() === username.toLowerCase()) {
    throw conflict('That username is already taken. Please choose another.');
  }
  if (email && existing.email === email) {
    throw conflict('An account already uses that email address.');
  }
  throw conflict('An account already uses that phone number.');
}

// -----------------------------------------------------------------------------
// Password change
// -----------------------------------------------------------------------------

export async function changeOwnPassword(
  user: AuthUser,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string,
): Promise<void> {
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) throw notFound('Your account could not be found.');

  if (!(await verifyPassword(currentPassword, record.passwordHash))) {
    throw new AppError('VALIDATION', 'Your current password is not correct.', {
      details: { currentPassword: ['Your current password is not correct.'] },
    });
  }

  const policy = checkPasswordPolicy(newPassword, {
    username: user.username,
    fullName: user.fullName,
    email: user.email,
  });
  if (!policy.ok) {
    throw new AppError('VALIDATION', policy.problems[0] as string, {
      details: { newPassword: policy.problems },
    });
  }

  if (await verifyPassword(newPassword, record.passwordHash)) {
    throw new AppError('VALIDATION', 'Choose a password you have not used before.', {
      details: { newPassword: ['Choose a password you have not used before.'] },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  // Everything else signed in as this account is now stale.
  const revoked = await revokeAllSessions(user.id, 'password_changed', currentSessionId);

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    actor: user,
    targetType: 'user',
    targetId: user.id,
    description: `${user.fullName} changed their password.`,
    severity: AUDIT_SEVERITY.WARNING,
    metadata: { otherSessionsRevoked: revoked },
  });

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Your password was changed',
    body:
      revoked > 0
        ? `You were signed out of ${revoked} other device${revoked === 1 ? '' : 's'}.`
        : 'If this was not you, tell your school administrator immediately.',
  });
}

/**
 * Administrator-initiated reset.
 *
 * This is the safe replacement for "let the Super Admin read the password":
 * the administrator sets a temporary credential, the account must replace it at
 * next sign-in, every existing session is destroyed, and the action is written
 * to the audit log as CRITICAL.
 */
export async function adminResetPassword(
  actor: AuthUser,
  targetUserId: string,
  temporaryPassword: string,
): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  });
  if (!target) throw notFound('That account could not be found.');

  if (target.role.key === ROLES.SUPER_ADMIN && target.id !== actor.id) {
    throw new AppError(
      'FORBIDDEN',
      'The Super Admin password can only be changed by the Super Admin.',
    );
  }

  const policy = checkPasswordPolicy(temporaryPassword, {
    username: target.username,
    fullName: target.fullName,
    email: target.email,
  });
  if (!policy.ok) {
    throw new AppError('VALIDATION', policy.problems[0] as string, {
      details: { temporaryPassword: policy.problems },
    });
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  await revokeAllSessions(targetUserId, 'password_reset_by_admin');

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET_BY_ADMIN,
    actor,
    targetType: 'user',
    targetId: targetUserId,
    description: `${actor.fullName} reset the password for ${target.fullName} (${target.username}).`,
    severity: AUDIT_SEVERITY.CRITICAL,
    metadata: { targetRole: target.role.key, mustChangePassword: true },
  });

  await notify({
    userId: targetUserId,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Your password was reset',
    body: 'An administrator set a temporary password. You will be asked to choose a new one when you sign in.',
  });
}

// -----------------------------------------------------------------------------
// Forgotten password
// -----------------------------------------------------------------------------

const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Always resolves successfully, whether or not the account exists — otherwise
 * the form becomes a way to test which email addresses are registered.
 * Returns the token only in development, where there is no mail transport.
 */
export async function requestPasswordReset(
  identifier: string,
): Promise<{ devToken?: string }> {
  const context = await getRequestContext();
  await enforceRateLimit(
    RATE_LIMITS.passwordReset,
    context.ipAddress ?? identifier.toLowerCase(),
  );

  const user = await findByIdentifier(identifier);
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    await recordAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      description: `Password reset requested for an unknown identifier "${identifier.slice(0, 60)}".`,
      severity: AUDIT_SEVERITY.INFO,
    });
    return {};
  }

  // One live token at a time.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hmacToken(token, 'password-reset'),
      userId: user.id,
      expiresAt: addMinutes(new Date(), RESET_TOKEN_TTL_MINUTES),
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    actor: { id: user.id, username: user.username, role: user.role.key as RoleKey },
    targetType: 'user',
    targetId: user.id,
    description: `${user.fullName} requested a password reset.`,
    severity: AUDIT_SEVERITY.WARNING,
  });

  const link = `${env.appUrl}/reset-password?token=${token}`;

  if (env.mail.driver === 'log') {
    console.info(
      `\n[fodan][password-reset] Link for ${user.username} (valid ${RESET_TOKEN_TTL_MINUTES} minutes):\n  ${link}\n`,
    );
  } else {
    // TODO: wire an SMTP transport here. Until MAIL_DRIVER is configured the
    // link is logged server-side and an administrator delivers it by hand,
    // which is honest about what the platform can actually do today.
    console.info(`[fodan][password-reset] MAIL_DRIVER=${env.mail.driver} not implemented; link logged instead.`);
    console.info(`  ${link}`);
  }

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Password reset requested',
    body: 'If this was not you, tell your school administrator immediately.',
  });

  return env.isProduction ? {} : { devToken: token };
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: { in: hmacTokenCandidates(token, 'password-reset') } },
    include: { user: { include: { role: true } } },
  });

  const invalid =
    !record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now();

  if (invalid) {
    throw new AppError(
      'VALIDATION',
      'This password reset link is no longer valid. Please request a new one.',
    );
  }

  const policy = checkPasswordPolicy(newPassword, {
    username: record.user.username,
    fullName: record.user.fullName,
    email: record.user.email,
  });
  if (!policy.ok) {
    throw new AppError('VALIDATION', policy.problems[0] as string, {
      details: { newPassword: policy.problems },
    });
  }

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
  ]);

  await revokeAllSessions(record.userId, 'password_reset');

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
    actor: {
      id: record.user.id,
      username: record.user.username,
      role: record.user.role.key as RoleKey,
    },
    targetType: 'user',
    targetId: record.userId,
    description: `${record.user.fullName} completed a password reset.`,
    severity: AUDIT_SEVERITY.CRITICAL,
  });
}
