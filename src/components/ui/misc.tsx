'use client';

import * as React from 'react';
import Link from 'next/link';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ChevronRight } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

/**
 * Smaller shared primitives: avatars, dropdown menus, tabs, tooltips,
 * breadcrumbs and description lists.
 */

// -----------------------------------------------------------------------------
// Avatar
// -----------------------------------------------------------------------------

const AVATAR_SIZES = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
} as const;

/**
 * Initials on a colour derived from the name, so a class list is scannable at a
 * glance and two students never look identical. The hash is deterministic, so
 * a person keeps the same colour across every screen.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const palettes = [
    'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
    'bg-spark-300/30 text-spark-600 dark:text-spark-300',
    'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500',
    'bg-warn-50 text-warn-700 dark:bg-warn-700/20 dark:text-warn-500',
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  ];

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 100_000;
  }
  const palette = palettes[hash % palettes.length] as string;

  if (src) {
    return (
      // A user-supplied avatar URL is not routed through next/image on purpose:
      // remote hosts would need to be allow-listed, and this platform stores
      // avatars locally when it stores them at all.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-[var(--line-soft)]',
          AVATAR_SIZES[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold uppercase',
        AVATAR_SIZES[size],
        palette,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Avatar plus name and a secondary line — the standard "person" cell. */
export function PersonCell({
  name,
  secondary,
  href,
  size = 'sm',
  avatarSrc,
}: {
  name: string;
  secondary?: React.ReactNode;
  href?: string;
  size?: keyof typeof AVATAR_SIZES;
  avatarSrc?: string | null;
}) {
  const body = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} src={avatarSrc} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[var(--text-strong)]">
          {name}
        </span>
        {secondary ? (
          <span className="block truncate text-xs text-[var(--text-muted)]">
            {secondary}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return body;

  return (
    <Link href={href} className="rounded hover:underline">
      {body}
    </Link>
  );
}

// -----------------------------------------------------------------------------
// Dropdown menu
// -----------------------------------------------------------------------------

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-[var(--radius-field)] border border-[var(--line-soft)] bg-[var(--surface-raised)] p-1 shadow-[var(--shadow-lift)]',
          'data-[state=open]:animate-pop',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  destructive?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors',
        'data-[highlighted]:bg-[var(--surface-sunken)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive
          ? 'text-danger-600 data-[highlighted]:bg-danger-50 dark:text-danger-500 dark:data-[highlighted]:bg-danger-700/15'
          : 'text-[var(--text-body)] data-[highlighted]:text-[var(--text-strong)]',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn(
        'px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
}: {
  className?: string;
}) {
  return (
    <DropdownPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--line-soft)]', className)}
    />
  );
}

// -----------------------------------------------------------------------------
// Tabs
// -----------------------------------------------------------------------------

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'thin-scroll flex gap-1 overflow-x-auto border-b border-[var(--line-soft)]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold text-[var(--text-muted)] transition-colors',
        'hover:text-[var(--text-strong)]',
        'data-[state=active]:text-brand-700 dark:data-[state=active]:text-brand-300',
        "data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-brand-600 data-[state=active]:after:content-['']",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('animate-fade-in pt-5 outline-none', className)}
      {...props}
    />
  );
}

/** Link-based tab strip, for sections that are separate routes. */
export function LinkTabs({
  items,
  current,
  className,
}: {
  items: { href: string; label: string; badge?: React.ReactNode }[];
  current: string;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        'thin-scroll flex gap-1 overflow-x-auto border-b border-[var(--line-soft)]',
        className,
      )}
    >
      {items.map((item) => {
        const active = current === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold transition-colors',
              active
                ? "text-brand-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600 after:content-[''] dark:text-brand-300"
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]',
            )}
          >
            {item.label}
            {item.badge}
          </Link>
        );
      })}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Tooltip
// -----------------------------------------------------------------------------

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-64 animate-pop rounded-lg bg-[var(--surface-inverse)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-inverse)] shadow-[var(--shadow-lift)]"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-[var(--surface-inverse)]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// -----------------------------------------------------------------------------
// Breadcrumb & description list
// -----------------------------------------------------------------------------

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded font-medium hover:text-[var(--text-strong)] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? 'font-semibold text-[var(--text-body)]' : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? (
                <ChevronRight className="size-3 opacity-60" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DescriptionList({
  items,
  className,
  columns = 2,
}: {
  items: { term: string; description: React.ReactNode }[];
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  const cols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
  } as const;

  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', cols[columns], className)}>
      {items.map((item) => (
        <div key={item.term} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {item.term}
          </dt>
          <dd className="mt-1 break-words text-sm font-medium text-[var(--text-strong)]">
            {item.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Copy-to-clipboard control, used for freshly generated activation codes. */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be denied; the value stays visible on screen,
          // so there is nothing to recover from beyond leaving the label alone.
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-strong)] px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[var(--surface-sunken)]',
        copied && 'border-success-500 text-success-700 dark:text-success-500',
        className,
      )}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
