import { Shell } from '@/components/layout/shell';
import { guardStaff } from '@/lib/auth/guards';
import { autoSubmitExpiredAttempts } from '@/lib/exam/engine';
import { expireLapsedCodes } from '@/lib/access-codes';

/**
 * Administrator area, shared by the Super Admin and Mini Admins.
 *
 * Each section guards itself by permission; this layout only establishes that
 * the visitor is staff at all. Two pieces of light housekeeping run here so the
 * platform stays truthful without a separate scheduler: expired examination
 * attempts are submitted, and lapsed access codes are marked expired.
 */
export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await guardStaff();

  void autoSubmitExpiredAttempts(10).catch(() => undefined);
  void expireLapsedCodes().catch(() => undefined);

  return <Shell user={user}>{children}</Shell>;
}
