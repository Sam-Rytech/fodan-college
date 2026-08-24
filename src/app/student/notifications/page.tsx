import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/card';
import { Pagination } from '@/components/ui/table';
import { NotificationList } from '@/components/notifications/notification-list';
import { guardStudent } from '@/lib/auth/guards';
import { listNotifications } from '@/lib/notifications';

export const metadata: Metadata = { title: 'Notifications' };

export default async function StudentNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await guardStudent();
  const { page } = await searchParams;

  const data = await listNotifications(user.id, {
    page: Number.parseInt(page ?? '1', 10) || 1,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="New lessons, examinations, results and replies to your posts."
      />

      <NotificationList
        unread={data.unread}
        items={data.items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          link: item.link,
          isRead: item.isRead,
          createdAt: item.createdAt.toISOString(),
        }))}
      />

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        total={data.total}
        pageSize={data.pageSize}
        buildHref={(next) => `/student/notifications?page=${next}`}
      />
    </div>
  );
}
