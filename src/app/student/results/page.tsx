import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, TrendingUp } from 'lucide-react';
import { Card, CardContent, PageHeader, StatCard } from '@/components/ui/card';
import { Badge, EmptyState, Progress } from '@/components/ui/feedback';
import {
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table';
import { guardLearningAccess } from '@/lib/auth/guards';
import { getStudentResults } from '@/lib/data/student';
import { average, formatDateTime, formatPercent } from '@/lib/utils';

export const metadata: Metadata = { title: 'My results' };

export default async function ResultsPage() {
  const user = await guardLearningAccess('/student/results');
  const results = await getStudentResults(user);

  // Results the teacher has not released are hidden from the numbers as well
  // as from the table, so an average can never leak an unreleased score.
  const visible = results.filter((result) => result.exam.showResultInstantly);
  const averagePercent = average(visible.map((result) => result.percentage));
  const passCount = visible.filter((result) => result.passed).length;

  return (
    <div>
      <PageHeader
        title="My results"
        description="Every examination you have submitted, newest first."
      />

      {results.length === 0 ? (
        <EmptyState
          icon={<Award className="size-6" aria-hidden />}
          title="No results yet"
          description="Your results will appear here as soon as you submit your first examination."
        />
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Examinations taken"
              value={results.length}
              icon={<Award className="size-5" aria-hidden />}
            />
            <StatCard
              label="Average score"
              value={visible.length > 0 ? formatPercent(averagePercent) : '—'}
              hint={
                visible.length === 0
                  ? 'No released results yet'
                  : `Across ${visible.length} released result${visible.length === 1 ? '' : 's'}`
              }
              icon={<TrendingUp className="size-5" aria-hidden />}
              tone="brand"
            />
            <StatCard
              label="Passed"
              value={visible.length > 0 ? `${passCount}/${visible.length}` : '—'}
              icon={<Award className="size-5" aria-hidden />}
              tone={passCount === visible.length && visible.length > 0 ? 'success' : 'warn'}
            />
          </section>

          {/* Mobile: cards. Desktop: a table. */}
          <div className="space-y-3 sm:hidden">
            {results.map((result) => (
              <Card key={result.id}>
                <Link href={`/student/results/${result.attemptId}`} className="block">
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                          {result.exam.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {result.subject.name} · {formatDateTime(result.submittedAt)}
                        </p>
                      </div>
                      {result.exam.showResultInstantly ? (
                        <Badge tone={result.passed ? 'success' : 'danger'}>
                          {result.grade}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Pending</Badge>
                      )}
                    </div>

                    {result.exam.showResultInstantly ? (
                      <Progress
                        value={result.percentage}
                        label={`${result.score}/${result.totalMarks}`}
                        showValue
                        tone={result.passed ? 'success' : 'danger'}
                        className="mt-3"
                      />
                    ) : null}
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>

          <TableWrap className="hidden sm:block">
            <Table caption="Your examination results">
              <Thead>
                <Tr>
                  <Th>Examination</Th>
                  <Th>Subject</Th>
                  <Th>Submitted</Th>
                  <Th numeric>Score</Th>
                  <Th numeric>Percentage</Th>
                  <Th>Grade</Th>
                  <Th>Outcome</Th>
                </Tr>
              </Thead>
              <Tbody>
                {results.map((result) => (
                  <Tr key={result.id}>
                    <Td>
                      <Link
                        href={`/student/results/${result.attemptId}`}
                        className="font-semibold text-[var(--text-strong)] hover:underline"
                      >
                        {result.exam.title}
                      </Link>
                    </Td>
                    <Td>{result.subject.name}</Td>
                    <Td>{formatDateTime(result.submittedAt)}</Td>
                    {result.exam.showResultInstantly ? (
                      <>
                        <Td numeric>
                          {result.score}/{result.totalMarks}
                        </Td>
                        <Td numeric>{formatPercent(result.percentage)}</Td>
                        <Td>
                          <span className="font-display font-bold">{result.grade}</span>
                        </Td>
                        <Td>
                          <Badge tone={result.passed ? 'success' : 'danger'} dot>
                            {result.passed ? 'Passed' : 'Not passed'}
                          </Badge>
                        </Td>
                      </>
                    ) : (
                      <Td colSpan={4} className="text-[var(--text-muted)]">
                        Awaiting release by your teacher
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </>
      )}
    </div>
  );
}
