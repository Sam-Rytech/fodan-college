import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';

export const metadata: Metadata = { title: 'Manage Classes' };

export default async function ManageClassesPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_CLASSES);

  const classes = await prisma.schoolClass.findMany({
    orderBy: { orderIndex: 'asc' },
    include: {
      _count: {
        select: { students: true, subjects: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Classes
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage academic classes, levels, and ordering.
          </p>
        </div>
        <Button iconLeft={<Plus className="size-4" />} asChild>
          <Link href="/manage/classes/new">Create class</Link>
        </Button>
      </div>

      <TableWrap>
        <Table caption="List of all classes in the system">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Level</Th>
              <Th numeric>Students</Th>
              <Th numeric>Subjects</Th>
              <Th>Status</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {classes.length === 0 ? (
              <TableEmpty colSpan={6} message="No classes found." />
            ) : (
              classes.map((cls) => (
                <Tr key={cls.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    {cls.name}
                  </Td>
                  <Td>{cls.level}</Td>
                  <Td numeric>{cls._count.students}</Td>
                  <Td numeric>{cls._count.subjects}</Td>
                  <Td>
                    {cls.isActive ? (
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
                      <Link href={`/manage/classes/${cls.id}`}>Edit</Link>
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
