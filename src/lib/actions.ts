import 'server-only';
import { headers } from 'next/headers';
import { z } from 'zod';
import { env } from './env';
import { AppError, forbidden, toClientError, type AppErrorCode } from './errors';

/**
 * Uniform result envelope and safety wrapper for every server action.
 *
 * Actions never throw across the RSC boundary. They return a discriminated
 * union so the client can render a field error, a toast, or a redirect without
 * guessing. Anything unexpected is logged server-side and replaced with a
 * generic message — internals never reach the browser.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      code: AppErrorCode;
      error: string;
      fieldErrors?: Record<string, string[]>;
      reference?: string;
    };

export function actionSuccess<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function actionFailure(
  code: AppErrorCode,
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, code, error, fieldErrors };
}

/**
 * Wraps an action body: verifies the request origin, converts thrown errors
 * into the envelope, and lets `redirect()` propagate (Next signals redirects by
 * throwing, so those must not be swallowed).
 */
export async function runAction<T>(
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    await assertSameOrigin();
    return await body();
  } catch (error) {
    if (isNextControlFlow(error)) throw error;

    const normalised = toClientError(error);
    return {
      ok: false,
      code: normalised.code,
      error: normalised.message,
      fieldErrors: normalised.details,
      reference: normalised.reference,
    };
  }
}

/**
 * Next.js already compares Origin against Host for Server Actions. This is a
 * second, explicit check so the protection is visible in the code and survives
 * a future move to plain route handlers, where it would not be automatic.
 */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get('origin');

  // Same-origin navigations and server-to-server calls may omit Origin.
  if (!origin) return;

  const allowed = new Set<string>([env.appUrl, ...env.allowedOrigins]);

  const host = headerList.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    if (!env.isProduction) allowed.add(`http://${host}`);
  }

  const normalise = (value: string) => value.replace(/\/+$/, '').toLowerCase();
  const normalisedAllowed = new Set([...allowed].map(normalise));

  if (!normalisedAllowed.has(normalise(origin))) {
    throw forbidden('This request could not be verified. Please reload the page.');
  }
}

/**
 * `redirect()` and `notFound()` work by throwing sentinel errors that Next
 * catches upstream. Re-throw them untouched.
 */
function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === 'string' && /^(NEXT_REDIRECT|NEXT_NOT_FOUND)/.test(digest);
}

// -----------------------------------------------------------------------------
// Input parsing
// -----------------------------------------------------------------------------

/**
 * Validates FormData against a Zod schema, returning field errors in the shape
 * the form components expect.
 */
export function parseForm<S extends z.ZodTypeAny>(
  schema: S,
  formData: FormData,
): z.infer<S> {
  const raw: Record<string, unknown> = {};

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    if (values.length > 1) {
      raw[key] = values;
    } else {
      const value = values[0];
      raw[key] = value instanceof File ? value : (value ?? '');
    }
  }

  return parseInput(schema, raw);
}

export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const flattened = result.error.flatten();
  throw new AppError('VALIDATION', firstMessage(flattened) ?? 'Please check the form and try again.', {
    details: flattened.fieldErrors as Record<string, string[]>,
  });
}

function firstMessage(flattened: {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}): string | undefined {
  if (flattened.formErrors[0]) return flattened.formErrors[0];
  for (const messages of Object.values(flattened.fieldErrors)) {
    if (messages?.[0]) return messages[0];
  }
  return undefined;
}
