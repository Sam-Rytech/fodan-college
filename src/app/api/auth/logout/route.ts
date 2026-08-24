import { NextResponse, type NextRequest } from 'next/server';
import { destroyCurrentSession, getCurrentUser } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';
import { AUDIT_ACTIONS } from '@/lib/constants';
import { env } from '@/lib/env';

/**
 * Sign out.
 *
 * POST only. A GET logout endpoint can be triggered by any `<img>` tag or link
 * preview on a page the user visits, which is a real (if mild) CSRF nuisance.
 * The Origin header is checked for the same reason.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin, request)) {
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      actor: user,
      targetType: 'user',
      targetId: user.id,
      description: `${user.fullName} signed out.`,
    });
  }

  await destroyCurrentSession('logout');

  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}

function isAllowedOrigin(origin: string, request: NextRequest): boolean {
  const normalise = (value: string) => value.replace(/\/+$/, '').toLowerCase();
  const allowed = new Set([env.appUrl, ...env.allowedOrigins].map(normalise));

  const host = request.headers.get('host');
  if (host) {
    allowed.add(normalise(`https://${host}`));
    if (!env.isProduction) allowed.add(normalise(`http://${host}`));
  }

  return allowed.has(normalise(origin));
}
