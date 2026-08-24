import { AppShell } from './app-shell';
import { navFor } from './nav-config';
import { getUnreadCount } from '@/lib/notifications';
import { getSetting } from '@/lib/settings';
import { SETTING_KEYS } from '@/lib/constants';
import { homePathFor } from '@/lib/auth/guards';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Server wrapper around the client shell.
 *
 * Everything the chrome needs — the filtered navigation, the unread count and
 * the platform announcement — is resolved here on the server, so the shell
 * renders complete on first paint with no client fetch and no layout shift.
 */
export async function Shell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const [unreadCount, announcement] = await Promise.all([
    getUnreadCount(user.id),
    getSetting(SETTING_KEYS.PLATFORM_ANNOUNCEMENT),
  ]);

  return (
    <AppShell
      user={user}
      unreadCount={unreadCount}
      homeHref={homePathFor(user)}
      announcement={announcement.trim() || null}
    >
      {children}
    </AppShell>
  );
}
