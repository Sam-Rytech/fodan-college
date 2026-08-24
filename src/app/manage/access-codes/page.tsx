import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search, Key } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { listAccessCodes } from '@/lib/access-codes';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty, Pagination } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { RevokeButton } from './revoke-button';

export const metadata: Metadata = { title: 'Manage Access Codes' };

export default async function ManageAccessCodesPage({
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
    ? (params.status as any)
    : undefined;

  const data = await listAccessCodes({ page, search, classId, status });
  const classes = await prisma.schoolClass.findMany({ orderBy: { orderIndex: 'asc' } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Access Codes
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage activation codes for students.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button iconLeft={<Key className="size-4" />} asChild>
            <Link href="/manage/access-codes/generate">Generate Codes</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto" method="GET" action="/manage/access-codes">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search by student or code..."
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
          <select
            name="status"
            defaultValue={status || ''}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="USED">Used</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of access codes">
          <Thead>
            <Tr>
              <Th>Prefix / Last 4</Th>
              <Th>Student</Th>
              <Th>Status</Th>
              <Th>Expires At</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.codes.length === 0 ? (
              <TableEmpty colSpan={5} message="No access codes found." />
            ) : (
              data.codes.map((code) => (
                <Tr key={code.id}>
                  <Td className="font-mono text-sm">
                    {code.codePrefix}-****-{code.codeLast4}
                  </Td>
                  <Td className="font-medium text-[var(--text-strong)]">
                    {code.student.fullName}
                  </Td>
                  <Td>
                    {code.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Active
                      </span>
                    ) : code.status === 'USED' ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        Used
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-inset ring-danger-600/20">
                        {code.status === 'EXPIRED' ? 'Expired' : 'Revoked'}
                      </span>
                    )}
                  </Td>
                  <Td>{formatDate(code.expiresAt)}</Td>
                  <Td numeric>
                    {code.status === 'ACTIVE' && (
                      <RevokeButton codeId={code.id} />
                    )}
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
            return `/manage/access-codes${str ? `?${str}` : ''}`;
          }}
          className="border-t border-[var(--line-soft)] px-4"
        />
      </TableWrap>
    </div>
  );
}
