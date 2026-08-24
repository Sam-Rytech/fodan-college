import { type Metadata } from 'next';
import { Search, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { guardStaff } from '@/lib/auth/guards';

import { ROLES, AUDIT_SEVERITY } from '@/lib/constants';
import { queryAuditLogs, listAuditActions } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty, Pagination } from '@/components/ui/table';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audit Trail' };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await guardStaff();
  // Audit log is restricted to Super Admin only
  requireRole(user, [ROLES.SUPER_ADMIN]);
  
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) || 1 : 1;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const action = typeof params.action === 'string' ? params.action : undefined;
  const severity = typeof params.severity === 'string' ? params.severity as any : undefined;

  const data = await queryAuditLogs({ page, search, action, severity });
  const actionTypes = await listAuditActions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
            System Audit Trail
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Immutable log of all sensitive actions in the platform.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex w-full items-center gap-2 sm:w-auto" method="GET" action="/manage/audit">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search descriptions, actors, targets..."
              className="w-full rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select
            name="action"
            defaultValue={action || ''}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[200px] truncate"
          >
            <option value="">All Actions</option>
            {actionTypes.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            name="severity"
            defaultValue={severity || ''}
            className="rounded-md border border-[var(--line-strong)] bg-white py-1.5 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Severities</option>
            <option value={AUDIT_SEVERITY.INFO}>Info</option>
            <option value={AUDIT_SEVERITY.WARNING}>Warning</option>
            <option value={AUDIT_SEVERITY.CRITICAL}>Critical</option>
          </select>
          <Button variant="secondary" size="sm" type="submit">Filter</Button>
        </form>
      </div>

      <TableWrap>
        <Table caption="List of audit records">
          <Thead>
            <Tr>
              <Th>Timestamp</Th>
              <Th>Action</Th>
              <Th>Actor</Th>
              <Th>Description</Th>
              <Th>Metadata</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.entries.length === 0 ? (
              <TableEmpty colSpan={5} message="No audit records found." />
            ) : (
              data.entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="whitespace-nowrap text-sm text-[var(--text-muted)]">
                    {formatDateTime()}
                  </Td>
                  <Td className="font-medium text-[var(--text-strong)]">
                    <div className="flex items-center gap-2">
                      {entry.severity === AUDIT_SEVERITY.CRITICAL ? (
                        <AlertOctagon className="size-4 text-danger-500" />
                      ) : entry.severity === AUDIT_SEVERITY.WARNING ? (
                        <AlertTriangle className="size-4 text-warning-500" />
                      ) : (
                        <Info className="size-4 text-blue-500" />
                      )}
                      <span className="truncate max-w-[150px]" title={entry.action}>{entry.action}</span>
                    </div>
                  </Td>
                  <Td>
                    {entry.actorUsername ? (
                      <div>
                        <div>{entry.actorUsername}</div>
                        <div className="text-xs text-[var(--text-muted)]">{entry.actorRole}</div>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)] italic">System</span>
                    )}
                  </Td>
                  <Td className="max-w-xs truncate text-sm" title={entry.description}>
                    {entry.description}
                  </Td>
                  <Td>
                    {entry.metadata && entry.metadata !== 'null' ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-brand-600 hover:underline focus:outline-none">View Details</summary>
                        <pre className="mt-2 max-w-xs overflow-x-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-[10px] leading-tight">
                          {JSON.stringify(JSON.parse(entry.metadata), null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs italic">None</span>
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
            if (action) qs.set('action', action);
            if (severity) qs.set('severity', severity);
            const str = qs.toString();
            return `/manage/audit${str ? `?${str}` : ''}`;
          }}
          className="border-t border-[var(--line-soft)] px-4"
        />
      </TableWrap>
    </div>
  );
}
