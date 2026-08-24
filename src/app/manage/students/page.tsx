import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { listStudents } from '@/lib/data/admin';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty, Pagination } from '@/components/ui/table';

export const metadata: Metadata = { title: 'Manage Students' };

export default async function ManageStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_STUDENTS);
  
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) || 1 : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const classId = typeof params.classId === 'string' ? params.classId : undefined;
  const status = typeof params.status === 'string' 
    ? (params.status as 'active' | 'disabled' | 'awaiting' | 'activated')
    : undefined;

  const data = await listStudents(user, { page, search, classId, status });
  const classes = await prisma.schoolClass.findMany({ orderBy: { orderIndex: 'asc' } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Students
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage student accounts and access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button iconLeft={<Plus className="size-4" />} asChild>
            <Link href="/manage/students/new">Register student</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto" method="GET" action="/manage/students">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search students..."
              className="w-full rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select
            name="classId"
            defaultValue={classId || ''}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of students">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Username</Th>
              <Th>Class</Th>
              <Th>Status</Th>
              <Th>Activation</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.students.length === 0 ? (
              <TableEmpty colSpan={6} message="No students found." />
            ) : (
              data.students.map((student) => (
                <Tr key={student.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    {student.user.fullName}
                  </Td>
                  <Td>{student.user.username}</Td>
                  <Td>{student.schoolClass?.name || 'Unassigned'}</Td>
                  <Td>
                    {student.user.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-inset ring-danger-600/20">
                        Disabled
                      </span>
                    )}
                  </Td>
                  <Td>
                    {student.isActivated ? (
                      <span className="text-xs text-[var(--text-muted)]">Activated</span>
                    ) : (
                      <span className="text-xs font-medium text-warning-700">Awaiting</span>
                    )}
                  </Td>
                  <Td numeric>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/manage/students/${student.userId}`}>Edit</Link>
                    </Button>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          pageCount={data.pageCount}
          buildHref={(p) => {
            const qs = new URLSearchParams();
            if (p > 1) qs.set('page', String(p));
            if (search) qs.set('search', search);
            if (classId) qs.set('classId', classId);
            if (status) qs.set('status', status);
            const str = qs.toString();
            return `/manage/students${str ? `?${str}` : ''}`;
          }}
          className="border-t border-[var(--line-soft)] px-4"
        />
      </TableWrap>
    </div>
  );
}
