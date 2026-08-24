import { type Metadata } from 'next';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardStaff, requirePermission } from '@/lib/auth/guards';

import { PERMISSIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty, Pagination } from '@/components/ui/table';
import { formatDate, formatDateTime } from '@/lib/utils';
import { classScopeFilter, subjectScopeFilter } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'Results Analytics' };

export default async function ManageResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await guardStaff();
  requirePermission(user, PERMISSIONS.MANAGE_EXAMS); // Repurposing exam permission to see results
  
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) || 1 : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const classId = typeof params.classId === 'string' ? params.classId : undefined;
  const subjectId = typeof params.subjectId === 'string' ? params.subjectId : undefined;
  const examId = typeof params.examId === 'string' ? params.examId : undefined;
  
  const classScope = classScopeFilter(user);
  const subjectScope = subjectScopeFilter(user);

  const pageSize = 20;

  const where = {
    ...classScope,
    ...subjectScope,
    ...(classId ? { classId } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(examId ? { examId } : {}),
    ...(search ? {
      student: {
        OR: [
          { fullName: { contains: search } },
          { username: { contains: search } }
        ]
      }
    } : {}),
  };

  const [total, results] = await Promise.all([
    prisma.result.count({ where }),
    prisma.result.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        student: { select: { fullName: true } },
        exam: { select: { title: true } },
        schoolClass: { select: { name: true } },
        subject: { select: { name: true } },
      },
    }),
  ]);

  const classes = await prisma.schoolClass.findMany({ where: classScope.classId ? { id: classScope.classId } : {}, orderBy: { orderIndex: 'asc' } });
  const subjects = await prisma.subject.findMany({ where: subjectScope.subjectId ? { id: subjectScope.subjectId } : {}, orderBy: { orderIndex: 'asc' } });
  const exams = await prisma.examination.findMany({ 
    where: { ...classScope, ...subjectScope }, 
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            Results Analytics
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Review student performance across examinations.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto flex-wrap" method="GET" action="/manage/results">
          <div className="relative flex-1 sm:w-48">
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
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            name="subjectId"
            defaultValue={subjectId || ''}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            name="examId"
            defaultValue={examId || ''}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[200px] truncate"
          >
            <option value="">All Exams</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of examination results">
          <Thead>
            <Tr>
              <Th>Student</Th>
              <Th>Exam</Th>
              <Th>Score</Th>
              <Th>Grade</Th>
              <Th>Date</Th>
            </Tr>
          </Thead>
          <Tbody>
            {results.length === 0 ? (
              <TableEmpty colSpan={5} message="No results found matching your filters." />
            ) : (
              results.map((result) => (
                <Tr key={result.id}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    {result.student.fullName}
                  </Td>
                  <Td>
                    <div>{result.exam.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {result.schoolClass.name} • {result.subject.name}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {result.passed ? (
                        <TrendingUp className="size-4 text-success-500" />
                      ) : (
                        <TrendingDown className="size-4 text-danger-500" />
                      )}
                      <span className={result.passed ? 'text-success-700 font-medium' : 'text-danger-700 font-medium'}>
                        {result.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {result.score} / {result.totalMarks} marks
                    </div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/20">
                      {result.grade}
                    </span>
                  </Td>
                  <Td className="text-sm text-[var(--text-muted)]">
                    {formatDateTime()}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          pageCount={Math.max(1, Math.ceil(total / pageSize))}
          buildHref={(p) => {
            const qs = new URLSearchParams();
            if (p > 1) qs.set('page', String(p));
            if (search) qs.set('search', search);
            if (classId) qs.set('classId', classId);
            if (subjectId) qs.set('subjectId', subjectId);
            if (examId) qs.set('examId', examId);
            const str = qs.toString();
            return `/manage/results${str ? `?${str}` : ''}`;
          }}
          className="border-t border-[var(--line-soft)] px-4"
        />
      </TableWrap>
    </div>
  );
}
