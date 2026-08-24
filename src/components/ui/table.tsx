'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * Data table primitives.
 *
 * The wrapper scrolls horizontally on small screens rather than shrinking the
 * text to illegibility, and every table gets a caption for screen readers even
 * when the visual design does not show one.
 */

export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'thin-scroll -mx-px overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Table({
  caption,
  className,
  children,
}: {
  caption: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <table className={cn('w-full min-w-[36rem] border-collapse text-sm', className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-[var(--surface-sunken)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </thead>
  );
}

export function Th({
  className,
  children,
  sortHref,
  sorted,
  numeric = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  sortHref?: string;
  sorted?: 'asc' | 'desc' | null;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      aria-sort={
        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
      }
      className={cn(
        'whitespace-nowrap px-4 py-3 font-semibold',
        numeric && 'text-right',
        className,
      )}
      {...props}
    >
      {sortHref ? (
        <Link
          href={sortHref}
          className="inline-flex items-center gap-1 rounded hover:text-[var(--text-strong)]"
        >
          {children}
          <ArrowUpDown
            className={cn('size-3', sorted ? 'opacity-100' : 'opacity-40')}
            aria-hidden
          />
        </Link>
      ) : (
        children
      )}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-[var(--line-soft)]">{children}</tbody>;
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-[var(--surface-sunken)]', className)}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-[var(--text-body)]',
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

/** Row shown in place of data when a filtered table has no matches. */
export function TableEmpty({
  colSpan,
  message = 'Nothing to show here yet.',
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-12 text-center text-sm text-[var(--text-muted)]"
      >
        {message}
      </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------
// Pagination
// -----------------------------------------------------------------------------

/**
 * Link-based pagination: every page is a real URL, so the browser back button,
 * bookmarking and sharing all behave. Page state never lives only in React.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  buildHref,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) {
    return total > 0 ? (
      <p className={cn('py-3 text-xs text-[var(--text-muted)]', className)}>
        Showing all {total} {total === 1 ? 'entry' : 'entries'}.
      </p>
    ) : null;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const pages = pageWindow(page, pageCount);

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-3',
        className,
      )}
      aria-label="Pagination"
    >
      <p className="text-xs text-[var(--text-muted)]">
        Showing <span className="font-semibold tabular-nums">{first}</span>–
        <span className="font-semibold tabular-nums">{last}</span> of{' '}
        <span className="font-semibold tabular-nums">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          asChild={page > 1}
          variant="secondary"
          size="icon-sm"
          disabled={page <= 1}
          aria-label="Previous page"
        >
          {page > 1 ? (
            <Link href={buildHref(page - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <ChevronLeft className="size-4" aria-hidden />
          )}
        </Button>

        {pages.map((entry, index) =>
          entry === null ? (
            <span
              key={`gap-${index}`}
              className="px-1.5 text-xs text-[var(--text-muted)]"
            >
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={buildHref(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors',
                entry === page
                  ? 'bg-brand-600 text-white'
                  : 'text-[var(--text-body)] hover:bg-[var(--surface-sunken)]',
              )}
            >
              {entry}
            </Link>
          ),
        )}

        <Button
          asChild={page < pageCount}
          variant="secondary"
          size="icon-sm"
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          {page < pageCount ? (
            <Link href={buildHref(page + 1)}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <ChevronRight className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    </nav>
  );
}

/** First, last, and a window around the current page; `null` marks a gap. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < pageCount) pages.add(page + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const output: (number | null)[] = [];

  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) output.push(null);
    output.push(value);
  }

  return output;
}
