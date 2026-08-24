import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus, ShieldAlert } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS, ROLES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';

export const metadata: Metadata = { title: 'Manage Administrators' };

export default async function ManageAdminsPage() {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_ADMINS);

  const admins = await prisma.user.findMany({
    where: { role: { in: [ROLES.MINI_ADMIN, ROLES.SUPER_ADMIN] } },
    orderBy: { fullName: 'asc' },
    include: {
      
      _count: {
        select: { classAssignments: true, subjectAssignments: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Administrators
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage staff accounts and permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button iconLeft={<Plus className="size-4" />} asChild>
            <Link href="/manage/admins/new">Create Administrator</Link>
          </Button>
        </div>
      </div>

      <TableWrap>
        <Table caption="List of staff accounts">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th numeric>Classes Assigned</Th>
              <Th numeric>Subjects Assigned</Th>
              <Th>Status</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {admins.length === 0 ? (
              <TableEmpty colSpan={6} message="No administrators found." />
            ) : (
              admins.map((admin) => (
                <Tr key={admin.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    <div className="flex items-center gap-2">
                      {admin.role === ROLES.SUPER_ADMIN && (
                        <ShieldAlert className="size-4 text-warning-500" />
                      )}
                      {admin.fullName}
                    </div>
                  </Td>
                  <Td>{admin.role === ROLES.SUPER_ADMIN ? 'Super Admin' : 'Admin'}</Td>
                  <Td numeric>
                    {admin.role === ROLES.SUPER_ADMIN ? 'All' : admin._count.classAssignments}
                  </Td>
                  <Td numeric>
                    {admin.role === ROLES.SUPER_ADMIN ? 'All' : admin._count.subjectAssignments}
                  </Td>
                  <Td>
                    {admin.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-inset ring-danger-600/20">
                        Disabled
                      </span>
                    )}
                  </Td>
                  <Td numeric>
                    {admin.id !== user.id && admin.role !== ROLES.SUPER_ADMIN && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/manage/admins/${admin.id}`}>Manage</Link>
                      </Button>
                    )}
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
