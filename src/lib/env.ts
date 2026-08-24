import 'server-only';

/**
 * Validated server-side configuration.
 *
 * Every secret and tunable enters the application through this module, which
 * fails fast at boot rather than letting a missing value surface as a confusing
 * runtime error later. Nothing here may be imported from a client component.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function int(name: string, value: string | undefined, fallback: number): number {
  const raw = optional(value, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}".`);
  }
  return parsed;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

/**
 * In test runs we allow a deterministic placeholder secret so unit tests do not
 * need a populated .env. Production always demands a real one.
 */
const authSecret = isTest
  ? optional(process.env.AUTH_SECRET, 'test-only-auth-secret-not-for-production')
  : required('AUTH_SECRET', process.env.AUTH_SECRET);

if (isProduction && authSecret.length < 32) {
  throw new Error(
    'AUTH_SECRET must be at least 32 characters in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
  );
}

if (isProduction && authSecret.startsWith('CHANGE_ME')) {
  throw new Error('AUTH_SECRET still holds its placeholder value. Set a real secret.');
}

const storageDriver = optional(process.env.STORAGE_DRIVER, 'local').toLowerCase();
if (storageDriver !== 'local' && storageDriver !== 's3') {
  throw new Error(`STORAGE_DRIVER must be "local" or "s3", got "${storageDriver}".`);
}

export const env = {
  isProduction,
  isTest,
  isDevelopment: !isProduction && !isTest,

  appUrl: optional(process.env.APP_URL, 'http://localhost:3000').replace(/\/+$/, ''),
  appName: optional(process.env.NEXT_PUBLIC_APP_NAME, 'Fodan College'),

  databaseUrl: isTest
    ? optional(process.env.DATABASE_URL, 'file:./dev.db')
    : required('DATABASE_URL', process.env.DATABASE_URL),

  authSecret,
  authSecretPrevious: optional(process.env.AUTH_SECRET_PREVIOUS, ''),
  bcryptRounds: Math.max(10, int('PASSWORD_BCRYPT_ROUNDS', process.env.PASSWORD_BCRYPT_ROUNDS, 12)),

  session: {
    cookieName: optional(process.env.SESSION_COOKIE_NAME, 'fodan_session'),
    absoluteTimeoutMinutes: int(
      'SESSION_ABSOLUTE_TIMEOUT_MINUTES',
      process.env.SESSION_ABSOLUTE_TIMEOUT_MINUTES,
      720,
    ),
    idleTimeoutMinutes: int(
      'SESSION_IDLE_TIMEOUT_MINUTES',
      process.env.SESSION_IDLE_TIMEOUT_MINUTES,
      120,
    ),
  },

  login: {
    maxAttempts: int('LOGIN_MAX_ATTEMPTS', process.env.LOGIN_MAX_ATTEMPTS, 6),
    lockoutMinutes: int('LOGIN_LOCKOUT_MINUTES', process.env.LOGIN_LOCKOUT_MINUTES, 15),
  },

  rateLimit: {
    driver: optional(process.env.RATE_LIMIT_DRIVER, 'memory'),
    redisUrl: optional(process.env.REDIS_URL, ''),
  },

  superAdmin: {
    username: optional(process.env.SUPERADMIN_USERNAME, 'FBanjo'),
    password: optional(process.env.SUPERADMIN_PASSWORD, ''),
    email: optional(process.env.SUPERADMIN_EMAIL, ''),
    fullName: optional(process.env.SUPERADMIN_FULLNAME, 'Super Administrator'),
    phone: optional(process.env.SUPERADMIN_PHONE, ''),
  },

  storage: {
    driver: storageDriver as 'local' | 's3',
    localDir: optional(process.env.STORAGE_LOCAL_DIR, './storage'),
    maxUploadMb: int('UPLOAD_MAX_SIZE_MB', process.env.UPLOAD_MAX_SIZE_MB, 200),
    s3: {
      bucket: optional(process.env.S3_BUCKET, ''),
      region: optional(process.env.S3_REGION, 'auto'),
      endpoint: optional(process.env.S3_ENDPOINT, ''),
      accessKeyId: optional(process.env.S3_ACCESS_KEY_ID, ''),
      secretAccessKey: optional(process.env.S3_SECRET_ACCESS_KEY, ''),
      forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, false),
    },
  },

  mail: {
    driver: optional(process.env.MAIL_DRIVER, 'log'),
    from: optional(process.env.MAIL_FROM, 'Fodan College <no-reply@fodancollege.local>'),
    smtp: {
      host: optional(process.env.SMTP_HOST, ''),
      port: int('SMTP_PORT', process.env.SMTP_PORT, 587),
      user: optional(process.env.SMTP_USER, ''),
      password: optional(process.env.SMTP_PASSWORD, ''),
      secure: bool(process.env.SMTP_SECURE, false),
    },
  },

  allowedOrigins: optional(process.env.ALLOWED_ORIGINS, '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  auditRecordIp: bool(process.env.AUDIT_RECORD_IP, true),
} as const;

if (env.storage.driver === 's3') {
  for (const [key, value] of Object.entries({
    S3_BUCKET: env.storage.s3.bucket,
    S3_ACCESS_KEY_ID: env.storage.s3.accessKeyId,
    S3_SECRET_ACCESS_KEY: env.storage.s3.secretAccessKey,
  })) {
    if (!value) {
      throw new Error(`STORAGE_DRIVER is "s3" but ${key} is not set.`);
    }
  }
}
