import { type Metadata } from 'next';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { ModerationActions } from './moderation-actions';

export const metadata: Metadata = { title: 'Forum Moderation' };

export default async function ForumModerationPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MODERATE_FORUM);

  // Get all open reports
  const reports = await prisma.forumReport.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: { fullName: true } },
      post: { select: { title: true, body: true, author: { select: { fullName: true } } } },
      reply: { select: { body: true, author: { select: { fullName: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Forum Moderation
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Review and action reported posts and replies.
          </p>
        </div>
      </div>

      <TableWrap>
        <Table caption="List of open forum reports">
          <Thead>
            <Tr>
              <Th>Date</Th>
              <Th>Target</Th>
              <Th>Reason / Content</Th>
              <Th>Reporter</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {reports.length === 0 ? (
              <TableEmpty colSpan={5} message="No pending reports. All caught up!" />
            ) : (
              reports.map((report) => {
                const targetName = report.postId ? 'Post' : 'Reply';
                const content = report.postId 
                  ? report.post?.body 
                  : report.reply?.body;
                const author = report.postId
                  ? report.post?.author.fullName
                  : report.reply?.author.fullName;
                
                return (
                  <Tr key={report.id}>
                    <Td className="whitespace-nowrap">{formatDate(report.createdAt)}</Td>
                    <Td className="font-medium text-[var(--text-strong)]">
                      <div className="flex items-center gap-2">
                        {report.postId ? (
                          <MessageSquare className="size-4 text-blue-500" />
                        ) : (
                          <MessageSquare className="size-4 text-brand-500" />
                        )}
                        {targetName} by {author}
                      </div>
                    </Td>
                    <Td>
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-inset ring-danger-600/20">
                          <AlertTriangle className="size-3" />
                          {report.reason}
                        </span>
                      </div>
                      <div className="text-sm text-[var(--text-muted)] line-clamp-2 max-w-md italic">
                        "{content}"
                      </div>
                    </Td>
                    <Td>{report.reporter.fullName}</Td>
                    <Td numeric>
                      <ModerationActions reportId={report.id} />
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
