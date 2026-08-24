'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  Award,
  BellRing,
  BookOpen,
  CheckCheck,
  CheckSquare,
  FileText,
  Megaphone,
  MessageCircle,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { NOTIFICATION_TYPES, type NotificationType } from '@/lib/constants';
import { cn, formatRelative } from '@/lib/utils';
import { markNotificationsReadAction } from '@/app/student/actions';

/**
 * Shared notification list for students and administrators.
 *
 * Clicking a notification marks it read and follows its link in one action —
 * a separate "mark read" affordance on every row would be noise.
 */

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const ICONS: Record<NotificationType, LucideIcon> = {
  [NOTIFICATION_TYPES.LESSON]: BookOpen,
  [NOTIFICATION_TYPES.EXAM]: FileText,
  [NOTIFICATION_TYPES.RESULT]: Award,
  [NOTIFICATION_TYPES.FORUM]: MessageCircle,
  [NOTIFICATION_TYPES.TASK]: CheckSquare,
  [NOTIFICATION_TYPES.ACCOUNT]: User,
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: Megaphone,
};

const TONES: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.LESSON]: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  [NOTIFICATION_TYPES.EXAM]: 'bg-warn-50 text-warn-700 dark:bg-warn-700/20 dark:text-warn-500',
  [NOTIFICATION_TYPES.RESULT]:
    'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500',
  [NOTIFICATION_TYPES.FORUM]:
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  [NOTIFICATION_TYPES.TASK]:
    'bg-spark-300/25 text-spark-600 dark:text-spark-300',
  [NOTIFICATION_TYPES.ACCOUNT]:
    'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  [NOTIFICATION_TYPES.ANNOUNCEMENT]:
    'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export function NotificationList({
  items,
  unread,
}: {
  items: NotificationRow[];
  unread: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const markAll = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('all', 'true');
      const result = await markNotificationsReadAction(formData);

      if (!result.ok) {
        toast({ tone: 'error', title: 'Could not update', description: result.error });
        return;
      }
      router.refresh();
    });
  };

  const markOne = (id: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('notificationId', id);
      await markNotificationsReadAction(formData);
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellRing className="size-6" aria-hidden />}
        title="Nothing to catch up on"
        description="New lessons, examinations, results and replies will show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {unread > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-strong)]">{unread}</span>{' '}
            unread
          </p>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={markAll}
            iconLeft={<CheckCheck className="size-4" aria-hidden />}
          >
            Mark all as read
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-[var(--line-soft)]">
            {items.map((item) => {
              const key = (item.type as NotificationType) in ICONS
                ? (item.type as NotificationType)
                : NOTIFICATION_TYPES.ACCOUNT;
              const Icon = ICONS[key];

              const inner = (
                <span className="flex w-full items-start gap-3 px-5 py-4 text-left">
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-xl',
                      TONES[key],
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'block min-w-0 flex-1 truncate text-sm',
                          item.isRead
                            ? 'font-medium text-[var(--text-body)]'
                            : 'font-bold text-[var(--text-strong)]',
                        )}
                      >
                        {item.title}
                      </span>
                      {!item.isRead ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-brand-600"
                          aria-label="Unread"
                        />
                      ) : null}
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 block text-sm text-[var(--text-muted)]">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                      {formatRelative(item.createdAt)}
                    </span>
                  </span>
                </span>
              );

              return (
                <li
                  key={item.id}
                  className={cn(
                    'transition-colors hover:bg-[var(--surface-sunken)]',
                    !item.isRead && 'bg-brand-50/40 dark:bg-brand-950/25',
                  )}
                >
                  {item.link ? (
                    <Link
                      href={item.link}
                      onClick={() => {
                        if (!item.isRead) markOne(item.id);
                      }}
                      className="block"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.isRead) markOne(item.id);
                      }}
                      className="block w-full"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
