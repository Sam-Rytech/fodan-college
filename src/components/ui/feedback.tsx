import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Inbox,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Status surfaces: badges, alerts, empty states, loading skeletons.
 *
 * Colour never carries meaning alone — every tone pairs with an icon and a
 * word, so the interface still reads correctly for a colour-blind user or on a
 * cheap phone screen in bright sunlight.
 */

// -----------------------------------------------------------------------------
// Badge
// -----------------------------------------------------------------------------

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warn'
  | 'danger'
  | 'info'
  | 'outline';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--surface-sunken)] text-[var(--text-muted)] ring-[var(--line-soft)]',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:ring-brand-900',
  success:
    'bg-success-50 text-success-700 ring-success-500/25 dark:bg-success-700/15 dark:text-success-500',
  warn: 'bg-warn-50 text-warn-700 ring-warn-500/25 dark:bg-warn-700/15 dark:text-warn-500',
  danger:
    'bg-danger-50 text-danger-700 ring-danger-500/25 dark:bg-danger-700/15 dark:text-danger-500',
  info: 'bg-spark-300/20 text-spark-600 ring-spark-400/30 dark:text-spark-300',
  outline: 'bg-transparent text-[var(--text-body)] ring-[var(--line-strong)]',
};

export function Badge({
  tone = 'neutral',
  className,
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Alert
// -----------------------------------------------------------------------------

export type AlertTone = 'info' | 'success' | 'warn' | 'danger';

const ALERT_TONES: Record<
  AlertTone,
  { wrapper: string; icon: React.ComponentType<{ className?: string }> }
> = {
  info: {
    wrapper:
      'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/70 dark:text-brand-100',
    icon: Info,
  },
  success: {
    wrapper:
      'border-success-500/30 bg-success-50 text-success-700 dark:bg-success-700/10 dark:text-success-500',
    icon: CheckCircle2,
  },
  warn: {
    wrapper:
      'border-warn-500/30 bg-warn-50 text-warn-700 dark:bg-warn-700/10 dark:text-warn-500',
    icon: AlertTriangle,
  },
  danger: {
    wrapper:
      'border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-danger-700/10 dark:text-danger-500',
    icon: ShieldAlert,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  className,
}: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const { wrapper, icon: Icon } = ALERT_TONES[tone];

  return (
    <div
      // Errors and warnings interrupt; information waits for a natural pause.
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-[var(--radius-field)] border p-4 text-sm',
        wrapper,
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? (
          <div className={cn('leading-relaxed', title && 'mt-0.5 opacity-90')}>
            {children}
          </div>
        ) : null}
        {actions ? <div className="mt-3 flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Empty state
// -----------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] px-6 py-14 text-center',
        className,
      )}
    >
      <span
        className="mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--text-muted)]"
        aria-hidden
      >
        {icon ?? <Inbox className="size-6" />}
      </span>
      <h3 className="text-base font-bold text-[var(--text-strong)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Loading
// -----------------------------------------------------------------------------

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton rounded-md', className)}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="surface space-y-3 p-5" aria-hidden>
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', index === rows - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-12 text-sm text-[var(--text-muted)]"
      role="status"
    >
      <span
        className="size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
        aria-hidden
      />
      {label}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Progress
// -----------------------------------------------------------------------------

export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'brand',
  size = 'md',
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tone?: 'brand' | 'success' | 'warn' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  const tones: Record<string, string> = {
    brand: 'bg-brand-600',
    success: 'bg-success-600',
    warn: 'bg-warn-500',
    danger: 'bg-danger-600',
  };
  const heights: Record<string, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className={className}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          {label ? (
            <span className="font-medium text-[var(--text-body)]">{label}</span>
          ) : (
            <span />
          )}
          {showValue ? (
            <span className="font-semibold tabular-nums text-[var(--text-strong)]">
              {Math.round(pct)}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className={cn(
          'w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]',
          heights[size],
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            tones[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Circular progress, used on subject tiles where space is tight. */
export function ProgressRing({
  value,
  size = 44,
  strokeWidth = 4,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(pct)} percent complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-[var(--surface-sunken)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-brand-600 transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[0.6875rem] font-bold tabular-nums text-[var(--text-strong)]">
        {Math.round(pct)}
      </span>
    </div>
  );
}
