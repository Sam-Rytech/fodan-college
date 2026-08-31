import 'server-only';
import { prisma, containsInsensitive } from './db';
import { env } from './env';
import { AUDIT_SEVERITY, type AuditAction, type AuditSeverity } from './constants';
import { getRequestContext } from './auth/session';
import type { AuthUser } from './auth/types';

/**
 * Append-only audit trail.
 *
 * Rules:
 *  - Writing is the only operation this module exposes. There is no update or
 *    delete path anywhere in the application, and production deployments should
 *    additionally revoke UPDATE/DELETE on `audit_logs` at the database level
 *    (see docs/SECURITY.md).
 *  - A failed audit write must never break the action it is recording, but it
 *    must be loud in the server log.
 *  - Metadata is scrubbed before it is written: any key that looks like a
 *    secret is dropped rather than persisted.
 */

const SENSITIVE_KEY = /(password|hash|token|secret|code|authorization|cookie)/i;

/** Keys that survive scrubbing despite matching the pattern above. */
const SAFE_KEY_ALLOWLIST = new Set([
  'codeId',
  'codePrefix',
  'codeLast4',
  'codeStatus',
  'passwordChangedAt',
  'mustChangePassword',
]);

export interface AuditEntry {
  action: AuditAction;
  actor?: Pick<AuthUser, 'id' | 'username' | 'role'> | null;
  targetType?: string;
  targetId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
  /** Overrides the ambient request context (used by seed scripts and jobs). */
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const context =
      entry.ipAddress !== undefined || entry.userAgent !== undefined
        ? { ipAddress: entry.ipAddress ?? null, userAgent: entry.userAgent ?? null }
        : await safeRequestContext();

    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actor?.id ?? null,
        actorUsername: entry.actor?.username ?? null,
        actorRole: entry.actor?.role ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        description: entry.description?.slice(0, 1000) ?? null,
        metadata: entry.metadata ? JSON.stringify(scrub(entry.metadata)) : null,
        severity: entry.severity ?? AUDIT_SEVERITY.INFO,
        ipAddress: env.auditRecordIp ? (context.ipAddress ?? null) : null,
        userAgent: context.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error('[fodan][audit] failed to write audit entry', {
      action: entry.action,
      error: error instanceof Error ? error.message : error,
    });
  }
}

/**
 * `headers()` throws outside a request scope (seed scripts, background jobs),
 * so fall back to an empty context instead of failing the audit write.
 */
async function safeRequestContext() {
  try {
    return await getRequestContext();
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

function scrub(input: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 3) return {};
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key) && !SAFE_KEY_ALLOWLIST.has(key)) {
      output[key] = '[redacted]';
      continue;
    }
    if (value === null || value === undefined) {
      output[key] = null;
    } else if (value instanceof Date) {
      output[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      output[key] = value.slice(0, 50).map((item) =>
        typeof item === 'object' && item !== null
          ? scrub(item as Record<string, unknown>, depth + 1)
          : item,
      );
    } else if (typeof value === 'object') {
      output[key] = scrub(value as Record<string, unknown>, depth + 1);
    } else if (typeof value === 'string') {
      output[key] = value.slice(0, 500);
    } else {
      output[key] = value;
    }
  }

  return output;
}

// -----------------------------------------------------------------------------
// Reading (Super Admin only — enforced by the caller)
// -----------------------------------------------------------------------------

export interface AuditQuery {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  severity?: AuditSeverity;
  from?: Date;
  to?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function queryAuditLogs(query: AuditQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { actorUsername: containsInsensitive(query.search) },
            { description: containsInsensitive(query.search) },
            { targetId: containsInsensitive(query.search) },
          ],
        }
      : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    entries,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Distinct action names present in the log, for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
    take: 200,
  });
  return rows.map((row) => row.action);
}
