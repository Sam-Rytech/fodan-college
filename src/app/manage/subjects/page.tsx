import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';

export const metadata: Metadata = { title: 'Manage Subjects' };

export default async function ManageSubjectsPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_SUBJECTS);

  const subjects = await prisma.subject.findMany({
    orderBy: { orderIndex: 'asc' },
    include: {
      _count: {
        select: { topics: true, classes: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Subjects
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage academic subjects and their assigned classes.
          </p>
        </div>
        <Button iconLeft={<Plus className="size-4" />} asChild>
          <Link href="/manage/subjects/new">Create subject</Link>
        </Button>
      </div>

      <TableWrap>
        <Table caption="List of all subjects in the system">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th numeric>Classes</Th>
              <Th numeric>Topics</Th>
              <Th>Status</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {subjects.length === 0 ? (
              <TableEmpty colSpan={6} message="No subjects found." />
            ) : (
              subjects.map((sub) => (
                <Tr key={sub.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    {sub.name}
                  </Td>
                  <Td>{sub.code}</Td>
                  <Td numeric>{sub._count.classes}</Td>
                  <Td numeric>{sub._count.topics}</Td>
                  <Td>
                    {sub.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        Inactive
                      </span>
                    )}
                  </Td>
                  <Td numeric>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/manage/subjects/${sub.id}`}>Edit</Link>
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
