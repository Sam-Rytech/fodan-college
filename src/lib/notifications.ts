import 'server-only';
import { prisma } from './db';
import { excerpt } from './sanitize';
import { NOTIFICATION_TYPES, ROLES, type NotificationType } from './constants';

/**
 * In-app notifications.
 *
 * Deliberately in-app only. Email and SMS delivery would need credentials the
 * school may not have, and a half-working channel is worse than an honest one:
 * every notification lands in the bell menu, which always works. The `mail`
 * module handles the two places where out-of-band delivery is unavoidable
 * (password reset and verification).
 *
 * Writing a notification must never break the action that triggered it, so
 * failures are logged and swallowed.
 */

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: excerpt(input.title, 150),
        body: input.body ? excerpt(input.body, 500) : null,
        link: input.link ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error('[fodan][notifications] failed to write notification', {
      userId: input.userId,
      type: input.type,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function notifyMany(
  userIds: readonly string[],
  input: Omit<NotifyInput, 'userId'>,
): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;

  try {
    const created = await prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        type: input.type,
        title: excerpt(input.title, 150),
        body: input.body ? excerpt(input.body, 500) : null,
        link: input.link ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })),
    });
    return created.count;
  } catch (error) {
    console.error('[fodan][notifications] bulk write failed', {
      count: unique.length,
      type: input.type,
      error: error instanceof Error ? error.message : error,
    });
    return 0;
  }
}

/** Every activated student in a class — the audience for a new lesson or exam. */
export async function notifyClass(
  classId: string,
  input: Omit<NotifyInput, 'userId'>,
): Promise<number> {
  const students = await prisma.studentProfile.findMany({
    where: { classId, isActivated: true, user: { status: 'ACTIVE' } },
    select: { userId: true },
  });
  return notifyMany(
    students.map((student) => student.userId),
    input,
  );
}

export async function notifyStaff(
  input: Omit<NotifyInput, 'userId'>,
  options: { includeSuperAdmin?: boolean } = {},
): Promise<number> {
  const roles = options.includeSuperAdmin === false
    ? [ROLES.MINI_ADMIN]
    : [ROLES.MINI_ADMIN, ROLES.SUPER_ADMIN];

  const staff = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: roles } },
    select: { id: true },
  });
  return notifyMany(
    staff.map((member) => member.id),
    input,
  );
}

// -----------------------------------------------------------------------------
// Reading
// -----------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function listNotifications(
  userId: string,
  options: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options.pageSize ?? 20));

  const where = {
    userId,
    ...(options.unreadOnly ? { isRead: false } : {}),
  };

  const [total, items, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    items,
    total,
    unread,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  // Scoped by userId so one account cannot mark another's notifications read.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.LESSON]: 'book-open',
  [NOTIFICATION_TYPES.EXAM]: 'file-text',
  [NOTIFICATION_TYPES.RESULT]: 'award',
  [NOTIFICATION_TYPES.FORUM]: 'message-circle',
  [NOTIFICATION_TYPES.TASK]: 'check-square',
  [NOTIFICATION_TYPES.ACCOUNT]: 'user',
  [NOTIFICATION_TYPES.ANNOUNCEMENT]: 'megaphone',
};
