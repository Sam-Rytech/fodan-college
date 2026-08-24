import { type Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search, FileText } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';

export const metadata: Metadata = { title: 'Manage Examinations' };

export default async function ManageExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_EXAMS);
  
  const params = await searchParams;
  const search = typeof params.search === 'string' ? params.search : undefined;

  const exams = await prisma.examination.findMany({
    where: search ? { title: { contains: search } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      subject: true,
      schoolClass: true,
      _count: {
        select: { attempts: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Examinations
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage test papers, DOCX imports, and question banks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button iconLeft={<Plus className="size-4" />} asChild>
            <Link href="/manage/examinations/import">Import from DOCX</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto" method="GET" action="/manage/examinations">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search examinations..."
              className="w-full rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of examinations">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Class / Subject</Th>
              <Th numeric>Questions</Th>
              <Th numeric>Attempts</Th>
              <Th>Status</Th>
              <Th className="w-12"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {exams.length === 0 ? (
              <TableEmpty colSpan={6} message="No examinations found." />
            ) : (
              exams.map((exam) => (
                <Tr key={exam.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-[var(--text-muted)]" />
                      {exam.title}
                    </div>
                  </Td>
                  <Td>{exam.schoolClass.name} • {exam.subject.name}</Td>
                  <Td numeric>{exam.totalQuestions}</Td>
                  <Td numeric>{exam._count.attempts}</Td>
                  <Td>
                    {exam.status === 'PUBLISHED' ? (
                      <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-inset ring-success-600/20">
                        Published
                      </span>
                    ) : exam.status === 'DRAFT' ? (
                      <span className="inline-flex items-center rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-inset ring-warning-600/20">
                        Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        Closed
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
