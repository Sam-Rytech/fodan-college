'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Unread indicator in the top bar.
 *
 * The count is rendered on the server with the rest of the shell, so it is
 * correct on load without a client fetch. It refreshes on navigation, which for
 * a school portal is often enough — polling every account every few seconds
 * would cost far more than it is worth here.
 */
export function NotificationBell({
  count,
  href,
  className,
}: {
  count: number;
  href: string;
  className?: string;
}) {
  const label =
    count === 0
      ? 'Notifications'
      : `Notifications, ${count} unread`;

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'relative grid size-10 place-items-center rounded-[var(--radius-field)] text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]',
        className,
      )}
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 ? (
        <span
          className="absolute right-1.5 top-1.5 grid min-w-4 animate-pop place-items-center rounded-full bg-danger-600 px-1 text-[0.625rem] font-bold leading-4 text-white"
          aria-hidden
        >
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  );
}
