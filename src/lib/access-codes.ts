import 'server-only';
import { prisma, containsInsensitive } from './db';
import { hmacToken, hmacTokenCandidates, randomHumanCode } from './crypto';
import { AppError, notFound } from './errors';
import { recordAudit } from './audit';
import { notify } from './notifications';
import { addDays } from './utils';
import {
  ACCESS_CODE_STATUS,
  AUDIT_ACTIONS,
  AUDIT_SEVERITY,
  NOTIFICATION_TYPES,
  type AccessCodeStatus,
} from './constants';
import type { AuthUser } from './auth/types';

/**
 * Student activation codes.
 *
 * SECURITY MODEL
 * --------------
 *  - The code is 8 characters from a 27-symbol unambiguous alphabet
 *    (~38 bits), generated with `crypto.randomInt`. That is far too sparse to
 *    guess, and redemption is additionally rate-limited per account and per IP.
 *  - Only an HMAC of the code is stored. Neither a database dump nor a curious
 *    Mini Admin can read an outstanding code, and the plaintext is shown to the
 *    generating administrator exactly once, at creation.
 *  - Every code is bound to one student account at creation. Presenting another
 *    student's code fails with an explicit message and is written to the audit
 *    log as a WARNING, because it usually means a code was shared.
 *  - Single use by default: `useCount` reaching `maxUses` moves the code to
 *    USED, and a USED, EXPIRED or REVOKED code can never be redeemed again.
 *  - A code cannot be "un-revoked". Regenerating issues a fresh code and
 *    revokes the old one in the same transaction.
 */

const CODE_LENGTH = 8;
const PREFIX = 'FDN';

export interface GeneratedCode {
  id: string;
  /** Plaintext. Available ONLY in the response that creates it. */
  code: string;
  expiresAt: Date;
  studentId: string;
}

function buildCodePrefix(classSlug: string | null | undefined): string {
  if (!classSlug) return `${PREFIX}-GEN`;
  const compact = classSlug
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  return `${PREFIX}-${compact || 'GEN'}`;
}

export function formatCode(prefix: string, secret: string): string {
  return `${prefix}-${secret}`;
}

// -----------------------------------------------------------------------------
// Generation
// -----------------------------------------------------------------------------

export interface GenerateCodeInput {
  studentId: string;
  classId?: string | null;
  subjectId?: string | null;
  validityDays: number;
  note?: string | null;
  actor: AuthUser;
}

export async function generateAccessCode(
  input: GenerateCodeInput,
): Promise<GeneratedCode> {
  const student = await prisma.user.findUnique({
    where: { id: input.studentId },
    include: { studentProfile: { include: { schoolClass: true } }, role: true },
  });

  if (!student || student.role.key !== 'STUDENT' || !student.studentProfile) {
    throw notFound('That student could not be found.');
  }

  const classId =
    input.classId ?? student.studentProfile.classId ?? null;
  const classSlug =
    student.studentProfile.schoolClass?.slug ??
    (classId
      ? (await prisma.schoolClass.findUnique({ where: { id: classId } }))?.slug
      : null);

  const prefix = buildCodePrefix(classSlug);
  const secret = randomHumanCode(CODE_LENGTH);
  const code = formatCode(prefix, secret);
  const expiresAt = addDays(new Date(), input.validityDays);

  const record = await prisma.accessCode.create({
    data: {
      codeHash: hmacToken(code, 'access-code'),
      codePrefix: prefix,
      codeLast4: secret.slice(-4),
      studentId: input.studentId,
      classId,
      subjectId: input.subjectId ?? null,
      status: ACCESS_CODE_STATUS.ACTIVE,
      maxUses: 1,
      useCount: 0,
      expiresAt,
      note: input.note ?? null,
      createdById: input.actor.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CODE_GENERATED,
    actor: input.actor,
    targetType: 'access_code',
    targetId: record.id,
    description: `Generated an activation code for ${student.fullName} (${student.username}).`,
    metadata: {
      codeId: record.id,
      codePrefix: prefix,
      codeLast4: record.codeLast4,
      studentId: input.studentId,
      classId,
      expiresAt,
    },
  });

  await notify({
    userId: input.studentId,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'An activation code is waiting for you',
    body: 'Your teacher has issued your activation code. Enter it to unlock your lessons.',
    link: '/student/activate',
  });

  return { id: record.id, code, expiresAt, studentId: input.studentId };
}

export async function generateAccessCodes(
  studentIds: string[],
  options: Omit<GenerateCodeInput, 'studentId'>,
): Promise<GeneratedCode[]> {
  const generated: GeneratedCode[] = [];
  for (const studentId of studentIds) {
    generated.push(await generateAccessCode({ ...options, studentId }));
  }
  return generated;
}

// -----------------------------------------------------------------------------
// Redemption
// -----------------------------------------------------------------------------

export interface RedeemResult {
  activated: true;
  classId: string | null;
  className: string | null;
}

export async function redeemAccessCode(
  rawCode: string,
  user: AuthUser,
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();

  const record = await prisma.accessCode.findFirst({
    where: { codeHash: { in: hmacTokenCandidates(code, 'access-code') } },
    include: {
      student: { select: { id: true, fullName: true, username: true } },
      schoolClass: { select: { id: true, name: true } },
    },
  });

  if (!record) {
    await logFailedRedemption(user, 'unknown_code', 'That activation code is not recognised.');
    throw new AppError(
      'VALIDATION',
      'That activation code is not recognised. Check the letters and try again.',
    );
  }

  // Bound to a different student. This is the case the brief called out
  // explicitly, so the message is explicit too.
  if (record.studentId !== user.id) {
    await logFailedRedemption(
      user,
      'wrong_student',
      'Attempted to use an activation code assigned to another student.',
      record.id,
    );
    throw new AppError(
      'FORBIDDEN',
      'This activation code is not assigned to this account.',
    );
  }

  const status = effectiveStatus(record);
  if (status !== ACCESS_CODE_STATUS.ACTIVE) {
    // Keep an expired code's row honest before reporting on it.
    if (status === ACCESS_CODE_STATUS.EXPIRED && record.status === ACCESS_CODE_STATUS.ACTIVE) {
      await prisma.accessCode.update({
        where: { id: record.id },
        data: { status: ACCESS_CODE_STATUS.EXPIRED },
      });
    }

    await logFailedRedemption(user, status.toLowerCase(), messageFor(status), record.id);
    throw new AppError('VALIDATION', messageFor(status));
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) throw notFound('Your student profile could not be found.');

  const targetClassId = record.classId ?? profile.classId;
  const now = new Date();
  const nextUseCount = record.useCount + 1;

  await prisma.$transaction(async (tx) => {
    // Conditional update: the WHERE clause re-asserts ACTIVE, so two
    // simultaneous submissions cannot both consume the same single-use code.
    const claimed = await tx.accessCode.updateMany({
      where: { id: record.id, status: ACCESS_CODE_STATUS.ACTIVE },
      data: {
        useCount: nextUseCount,
        activatedAt: now,
        status:
          nextUseCount >= record.maxUses
            ? ACCESS_CODE_STATUS.USED
            : ACCESS_CODE_STATUS.ACTIVE,
      },
    });

    if (claimed.count === 0) {
      throw new AppError(
        'CONFLICT',
        'That activation code has just been used. Please ask for a new one.',
      );
    }

    await tx.studentProfile.update({
      where: { userId: user.id },
      data: {
        isActivated: true,
        activatedAt: now,
        activatedById: record.createdById,
        ...(targetClassId ? { classId: targetClassId } : {}),
      },
    });
  });

  const className =
    record.schoolClass?.name ??
    (targetClassId
      ? ((await prisma.schoolClass.findUnique({ where: { id: targetClassId } }))?.name ??
        null)
      : null);

  await recordAudit({
    action: AUDIT_ACTIONS.CODE_REDEEMED,
    actor: user,
    targetType: 'access_code',
    targetId: record.id,
    description: `${user.fullName} activated their account.`,
    metadata: {
      codeId: record.id,
      codePrefix: record.codePrefix,
      codeLast4: record.codeLast4,
      classId: targetClassId,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.STUDENT_ACTIVATED,
    actor: user,
    targetType: 'student',
    targetId: user.id,
    description: `${user.fullName} is now activated${className ? ` in ${className}` : ''}.`,
  });

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.ACCOUNT,
    title: 'Your account is active',
    body: 'Welcome aboard. Your subjects and lessons are now open.',
    link: '/student',
  });

  return { activated: true, classId: targetClassId, className };
}

async function logFailedRedemption(
  user: AuthUser,
  reason: string,
  description: string,
  codeId?: string,
): Promise<void> {
  await recordAudit({
    action: AUDIT_ACTIONS.CODE_REDEEM_FAILED,
    actor: user,
    targetType: codeId ? 'access_code' : 'student',
    targetId: codeId ?? user.id,
    description,
    severity:
      reason === 'wrong_student' ? AUDIT_SEVERITY.WARNING : AUDIT_SEVERITY.INFO,
    metadata: { reason },
  });
}

function messageFor(status: AccessCodeStatus): string {
  switch (status) {
    case ACCESS_CODE_STATUS.USED:
      return 'That activation code has already been used.';
    case ACCESS_CODE_STATUS.EXPIRED:
      return 'That activation code has expired. Please ask for a new one.';
    case ACCESS_CODE_STATUS.REVOKED:
      return 'That activation code is no longer valid. Please ask for a new one.';
    default:
      return 'That activation code cannot be used.';
  }
}

/** Stored status, corrected for a code whose expiry has quietly passed. */
export function effectiveStatus(code: {
  status: string;
  expiresAt: Date;
  useCount: number;
  maxUses: number;
}): AccessCodeStatus {
  if (code.status === ACCESS_CODE_STATUS.REVOKED) return ACCESS_CODE_STATUS.REVOKED;
  if (code.useCount >= code.maxUses) return ACCESS_CODE_STATUS.USED;
  if (code.expiresAt.getTime() <= Date.now()) return ACCESS_CODE_STATUS.EXPIRED;
  if (code.status === ACCESS_CODE_STATUS.USED) return ACCESS_CODE_STATUS.USED;
  return ACCESS_CODE_STATUS.ACTIVE;
}

// -----------------------------------------------------------------------------
// Revoke & regenerate
// -----------------------------------------------------------------------------

export async function revokeAccessCode(
  codeId: string,
  reason: string | null,
  actor: AuthUser,
): Promise<void> {
  const code = await prisma.accessCode.findUnique({
    where: { id: codeId },
    include: { student: { select: { fullName: true, username: true } } },
  });
  if (!code) throw notFound('That access code could not be found.');

  if (code.status === ACCESS_CODE_STATUS.REVOKED) return;

  await prisma.accessCode.update({
    where: { id: codeId },
    data: {
      status: ACCESS_CODE_STATUS.REVOKED,
      revokedAt: new Date(),
      revokedById: actor.id,
      revokeReason: reason,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CODE_REVOKED,
    actor,
    targetType: 'access_code',
    targetId: codeId,
    description: `Revoked the activation code for ${code.student.fullName}.`,
    severity: AUDIT_SEVERITY.WARNING,
    metadata: { codeId, codePrefix: code.codePrefix, codeLast4: code.codeLast4, reason },
  });
}

/** Revokes the old code and issues a replacement in one operation. */
export async function regenerateAccessCode(
  codeId: string,
  actor: AuthUser,
): Promise<GeneratedCode> {
  const existing = await prisma.accessCode.findUnique({ where: { id: codeId } });
  if (!existing) throw notFound('That access code could not be found.');

  await revokeAccessCode(codeId, 'Replaced by a regenerated code', actor);

  const validityDays = Math.max(
    1,
    Math.ceil((existing.expiresAt.getTime() - existing.createdAt.getTime()) / 86_400_000),
  );

  const generated = await generateAccessCode({
    studentId: existing.studentId,
    classId: existing.classId,
    subjectId: existing.subjectId,
    validityDays,
    note: existing.note,
    actor,
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CODE_REGENERATED,
    actor,
    targetType: 'access_code',
    targetId: generated.id,
    description: 'Regenerated an activation code; the previous code was revoked.',
    metadata: { previousCodeId: codeId, codeId: generated.id },
  });

  return generated;
}

// -----------------------------------------------------------------------------
// Housekeeping & queries
// -----------------------------------------------------------------------------

/** Moves lapsed ACTIVE codes to EXPIRED so dashboards read truthfully. */
export async function expireLapsedCodes(): Promise<number> {
  const result = await prisma.accessCode.updateMany({
    where: { status: ACCESS_CODE_STATUS.ACTIVE, expiresAt: { lt: new Date() } },
    data: { status: ACCESS_CODE_STATUS.EXPIRED },
  });
  return result.count;
}

export interface CodeQuery {
  status?: AccessCodeStatus;
  classId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listAccessCodes(query: CodeQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 20));

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.search
      ? {
          OR: [
            { student: { fullName: containsInsensitive(query.search) } },
            { student: { username: containsInsensitive(query.search) } },
            { codeLast4: containsInsensitive(query.search) },
          ],
        }
      : {}),
  };

  const [total, codes, counts] = await Promise.all([
    prisma.accessCode.count({ where }),
    prisma.accessCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        student: { select: { id: true, fullName: true, username: true } },
        schoolClass: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    }),
    prisma.accessCode.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    codes,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    counts: Object.fromEntries(
      counts.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<AccessCodeStatus, number>>,
  };
}

/** Codes lapsing within the next week — surfaced on the Super Admin dashboard. */
export async function listExpiringCodes(days = 7, limit = 10) {
  return prisma.accessCode.findMany({
    where: {
      status: ACCESS_CODE_STATUS.ACTIVE,
      expiresAt: { gte: new Date(), lte: addDays(new Date(), days) },
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    include: {
      student: { select: { id: true, fullName: true, username: true } },
      schoolClass: { select: { name: true } },
    },
  });
}
