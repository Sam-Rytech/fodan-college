/**
 * Application error taxonomy.
 *
 * Two audiences, two messages:
 *  - `message` is safe to show a normal user. It never names a table, a file
 *    path, a stack frame or a third-party service.
 *  - anything diagnostic goes to the server log via `logServerError`, keyed by
 *    a short reference the user can quote to an administrator.
 */

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ACCOUNT_LOCKED'
  | 'NOT_ACTIVATED'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'UPLOAD_REJECTED'
  | 'EXAM_RULE'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  ACCOUNT_LOCKED: 423,
  NOT_ACTIVATED: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  UPLOAD_REJECTED: 415,
  EXAM_RULE: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  /** Extra context written to the server log only. */
  readonly internal?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { details?: Record<string, string[]>; internal?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options.details;
    this.internal = options.internal;
  }
}

export const unauthenticated = (message = 'Please sign in to continue.') =>
  new AppError('UNAUTHENTICATED', message);

export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError('FORBIDDEN', message);

export const notFound = (message = 'We could not find what you were looking for.') =>
  new AppError('NOT_FOUND', message);

export const validationError = (
  message: string,
  details?: Record<string, string[]>,
) => new AppError('VALIDATION', message, { details });

export const conflict = (message: string) => new AppError('CONFLICT', message);

export const rateLimited = (
  message = 'Too many attempts. Please wait a moment and try again.',
) => new AppError('RATE_LIMITED', message);

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Normalises anything thrown into a shape safe to hand to a client.
 * Unknown errors are logged with a reference and replaced with a generic
 * message so internals never leak.
 */
export function toClientError(error: unknown): {
  code: AppErrorCode;
  status: number;
  message: string;
  details?: Record<string, string[]>;
  reference?: string;
} {
  if (error instanceof AppError) {
    if (error.internal !== undefined) {
      logServerError(error.internal, error.code);
    }
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details,
    };
  }

  const reference = logServerError(error, 'INTERNAL');
  return {
    code: 'INTERNAL',
    status: 500,
    message: GENERIC_ERROR_MESSAGE,
    reference,
  };
}

/**
 * Writes full diagnostics to the server log and returns a short reference the
 * user can quote. The reference is random, so it reveals nothing by itself.
 */
export function logServerError(error: unknown, code: string = 'INTERNAL'): string {
  const reference = Math.random().toString(36).slice(2, 10).toUpperCase();
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: error };

  console.error(
    `[fodan][${code}][ref:${reference}]`,
    JSON.stringify(detail, null, 2),
  );
  return reference;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
