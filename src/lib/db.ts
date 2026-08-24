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
