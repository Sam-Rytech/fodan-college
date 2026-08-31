import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search, FileVideo, FileText, FileAudio } from 'lucide-react';
import { prisma, containsInsensitive } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';
import { classScopeFilter, subjectScopeFilter } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'Manage Learning Materials' };

function getIcon(type: string) {
  if (type === 'VIDEO') return <FileVideo className="size-4 text-brand-500" />;
  if (type === 'AUDIO') return <FileAudio className="size-4 text-blue-500" />;
  return <FileText className="size-4 text-gray-500" />;
}

export default async function ManageMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.UPLOAD_MATERIALS);
  
  const params = await searchParams;
  const search = typeof params.search === 'string' ? params.search : undefined;
  
  const classScope = classScopeFilter(user);
  const subjectScope = subjectScopeFilter(user);

  const materials = await prisma.learningMaterial.findMany({
    where: {
      ...classScope,
      ...subjectScope,
      ...(search ? { title: containsInsensitive(search) } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      topic: true,
      subject: true,
      schoolClass: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Learning Materials
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Upload and manage lesson content for your classes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button iconLeft={<Plus className="size-4" />} asChild>
            <Link href="/manage/materials/new">Upload Material</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto" method="GET" action="/manage/materials">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search materials..."
              className="w-full rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of learning materials">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Class / Subject</Th>
              <Th>Topic</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {materials.length === 0 ? (
              <TableEmpty colSpan={6} message="No materials found." />
            ) : (
              materials.map((material) => (
                <Tr key={material.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    <div className="flex items-center gap-2">
                      {getIcon(material.type)}
                      {material.title}
                    </div>
                  </Td>
                  <Td>{material.schoolClass.name} • {material.subject.name}</Td>
                  <Td>{material.topic.title}</Td>
                  <Td>{material.type}</Td>
                  <Td>
                    {material.status === 'PUBLISHED' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Published
                      </span>
                    ) : material.status === 'DRAFT' ? (
                      <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-inset ring-warning-600/20">
                        Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        Archived
                      </span>
                    )}
                  </Td>
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
