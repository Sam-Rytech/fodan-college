import 'server-only';
import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * A single PrismaClient per process.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until the database refuses connections, so the
 * instance is cached on globalThis outside production.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from '@prisma/client';

/**
 * A case-insensitive `contains` filter that works on both providers.
 *
 * SQLite's LIKE is already case-insensitive for ASCII, so plain `contains` was
 * enough while local development drove the schema. PostgreSQL's LIKE is case
 * sensitive, which would silently narrow every admin search after the switch.
 * Prisma only accepts `mode` on providers that support it, hence the cast.
 */
export function containsInsensitive(value: string): { contains: string } {
  return (
    env.databaseUrl.startsWith('file:')
      ? { contains: value }
      : { contains: value, mode: 'insensitive' }
  ) as { contains: string };
}
