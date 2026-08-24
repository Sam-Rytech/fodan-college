import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card primitives. Composition over configuration: `Card` is the surface,
 * everything else is an optional slot, so a stat tile and a full data panel
 * share one border radius, one border colour and one shadow.
 */

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'surface shadow-[var(--shadow-soft)]',
        interactive &&
          'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line-soft)] px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  as: Tag = 'h2',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}) {
  return <Tag className={cn('text-base font-bold', className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-[var(--text-muted)]', className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-soft)] bg-[var(--surface-sunken)] px-5 py-3',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Dashboard statistic tile. `tone` maps to a colour family rather than a raw
 * colour so a tile can be recoloured without hunting through class strings.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'brand' | 'success' | 'warn' | 'danger' | 'neutral';
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
    success:
      'bg-success-50 text-success-700 dark:bg-success-700/15 dark:text-success-500',
    warn: 'bg-warn-50 text-warn-700 dark:bg-warn-700/15 dark:text-warn-500',
    danger: 'bg-danger-50 text-danger-700 dark:bg-danger-700/15 dark:text-danger-500',
    neutral: 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  };

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-medium text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--text-strong)] tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl',
              tones[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/** Page-level heading block used at the top of every dashboard screen. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
