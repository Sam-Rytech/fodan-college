import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus, CheckSquare, Search } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { TASK_STATUS } from '@/lib/constants';

export const metadata: Metadata = { title: 'Tasks' };

export default async function ManageTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await guardStaff();
  
  const params = await searchParams;
  const filter = typeof params.filter === 'string' ? params.filter : 'mine';
  const statusFilter = typeof params.status === 'string' ? params.status : 'open';

  // "mine" = tasks assigned to me, "created" = tasks I created, "all" = all tasks
  // "open" = pending/in_progress, "all" = any status
  
  const tasks = await prisma.task.findMany({
    where: {
      ...(filter === 'mine' ? { assignedToId: user.id } : filter === 'created' ? { createdById: user.id } : {}),
      ...(statusFilter === 'open' ? { status: { in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] } } : {}),
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' }
    ],
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Tasks
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your assignments and administrative duties.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button iconLeft={<Plus className="size-4" />} asChild>
            <Link href="/manage/tasks/new">Create Task</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto" method="GET" action="/manage/tasks">
          <select
            name="filter"
            defaultValue={filter}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="mine">Assigned to me</option>
            <option value="created">Created by me</option>
            <option value="all">All tasks</option>
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="open">Open (Pending / In Progress)</option>
            <option value="all">All statuses</option>
          </select>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of tasks">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Assigned To</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Due Date</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {tasks.length === 0 ? (
              <TableEmpty colSpan={6} message="No tasks found." />
            ) : (
              tasks.map((task) => (
                <Tr key={task.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="size-4 text-[var(--text-muted)]" />
                      {task.title}
                    </div>
                  </Td>
                  <Td>{task.assignedTo.fullName}</Td>
                  <Td>
                    {task.priority === 'URGENT' ? (
                      <span className="text-danger-600 font-medium">Urgent</span>
                    ) : task.priority === 'HIGH' ? (
                      <span className="text-warning-600 font-medium">High</span>
                    ) : task.priority === 'LOW' ? (
                      <span className="text-gray-500">Low</span>
                    ) : (
                      <span>Medium</span>
                    )}
                  </Td>
                  <Td>
                    {task.status === TASK_STATUS.COMPLETED ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Completed
                      </span>
                    ) : task.status === TASK_STATUS.IN_PROGRESS ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        In Progress
                      </span>
                    ) : task.status === TASK_STATUS.CANCELLED ? (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20">
                        Cancelled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-inset ring-warning-600/20">
                        Pending
                      </span>
                    )}
                  </Td>
                  <Td>{formatDate(task.dueDate)}</Td>
                  <Td numeric>
                    <Button variant="ghost" size="sm" asChild>
                      {/* Using # as a placeholder since we haven't built the edit page yet */}
                      <Link href={`#`}>Manage</Link>
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
