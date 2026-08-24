import { Shell } from '@/components/layout/shell';
import { guardStudent } from '@/lib/auth/guards';
import { autoSubmitExpiredAttempts } from '@/lib/exam/engine';

/**
 * Student area.
 *
 * The layout also sweeps any of this student's examination attempts whose
 * deadline passed while the browser was closed. Doing it here means the
 * platform stays correct without a separate scheduler — the worst case is a
 * result appearing the next time the student opens the portal, which is exactly
 * when they would look for it.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await guardStudent();

  // Fire-and-forget: a sweep failure must never block the page.
  void autoSubmitExpiredAttempts(5).catch(() => undefined);

  return <Shell user={user}>{children}</Shell>;
}
