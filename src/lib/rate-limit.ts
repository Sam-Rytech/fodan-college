import 'server-only';
import { env } from './env';
import { rateLimited } from './errors';

/**
 * Fixed-window rate limiting.
 *
 * The default driver is a per-process in-memory map, which is correct for a
 * single Node instance and is the deployment this platform starts from. It is
 * NOT sufficient across multiple instances — behind a load balancer each
 * process would keep its own counters. The `RateLimitStore` interface exists so
 * a Redis-backed store can be dropped in without touching call sites; see
 * docs/DEPLOYMENT.md.
 *
 * Rate limiting is a availability control, not the primary defence: per-account
 * lockout (users.failedLoginCount / lockedUntil) is enforced independently in
 * the database, so an attacker rotating IP addresses still trips the lockout.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

class MemoryStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  async hit(key: string, windowMs: number) {
    const now = Date.now();
    this.sweep(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }

    existing.count += 1;
    return existing;
  }

  async reset(key: string) {
    this.buckets.delete(key);
  }

  /** Drop expired buckets occasionally so the map cannot grow without bound. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

const globalForRateLimit = globalThis as unknown as {
  __fodanRateLimitStore?: RateLimitStore;
};

const store: RateLimitStore =
  globalForRateLimit.__fodanRateLimitStore ?? new MemoryStore();

if (!env.isProduction) {
  globalForRateLimit.__fodanRateLimitStore = store;
}

export interface RateLimitRule {
  /** Stable name, used as part of the bucket key. */
  name: string;
  limit: number;
  windowSeconds: number;
}

/** Named policies, so limits live in one place instead of scattered magic numbers. */
export const RATE_LIMITS = {
  login: { name: 'login', limit: env.login.maxAttempts, windowSeconds: 900 },
  register: { name: 'register', limit: 5, windowSeconds: 3600 },
  passwordReset: { name: 'password-reset', limit: 5, windowSeconds: 3600 },
  activationCode: { name: 'activation-code', limit: 8, windowSeconds: 900 },
  forumPost: { name: 'forum-post', limit: 15, windowSeconds: 600 },
  upload: { name: 'upload', limit: 40, windowSeconds: 3600 },
  examSubmit: { name: 'exam-submit', limit: 30, windowSeconds: 600 },
  general: { name: 'general', limit: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export async function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const key = `${rule.name}:${identifier}`;
  const bucket = await store.hit(key, windowMs);

  const allowed = bucket.count <= rule.limit;
  const resetAt = new Date(bucket.resetAt);

  return {
    allowed,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - bucket.count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
  };
}

/** Throws a user-safe AppError when the limit is exceeded. */
export async function enforceRateLimit(
  rule: RateLimitRule,
  identifier: string,
  message?: string,
): Promise<void> {
  const result = await checkRateLimit(rule, identifier);
  if (!result.allowed) {
    throw rateLimited(
      message ??
        `Too many attempts. Please wait ${formatWait(result.retryAfterSeconds)} and try again.`,
    );
  }
}

export async function resetRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<void> {
  await store.reset(`${rule.name}:${identifier}`);
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
