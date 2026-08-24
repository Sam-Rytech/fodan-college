'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, Search, X } from 'lucide-react';
import { LogoLockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme';
import { Avatar } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { Badge } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/lib/auth/types';
import { isActivePath, navFor, type NavSection } from './nav-config';
import { NotificationBell } from './notification-bell';

/**
 * The application shell: a persistent sidebar on desktop, a slide-over drawer
 * on phones, and a sticky top bar carrying identity and notifications.
 *
 * Two details worth stating:
 *  - The drawer closes on navigation. Without that, tapping a link on a phone
 *    leaves the menu covering the page you just asked for.
 *  - Focus moves into the drawer when it opens and Escape closes it, so it is
 *    usable without a pointer.
 */

export function AppShell({
  user,
  unreadCount,
  homeHref,
  children,
  announcement,
}: {
  user: AuthUser;
  unreadCount: number;
  homeHref: string;
  children: React.ReactNode;
  announcement?: string | null;
}) {
  const pathname = usePathname();
  const nav = navFor(user);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close the drawer whenever the route changes.
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-page">
      {/* --- Desktop sidebar ------------------------------------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--line-soft)] bg-[var(--surface-card)] lg:flex">
        <div className="flex h-16 items-center border-b border-[var(--line-soft)] px-5">
          <LogoLockup size="sm" href={homeHref} />
        </div>
        <SidebarNav nav={nav} pathname={pathname} unreadCount={unreadCount} />
        <SidebarFooter user={user} />
      </aside>

      {/* --- Mobile drawer --------------------------------------------- */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 animate-fade-in bg-[color-mix(in_srgb,var(--color-ink)_55%,transparent)] backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col border-r border-[var(--line-soft)] bg-[var(--surface-card)] shadow-[var(--shadow-lift)]"
          >
            <div className="flex h-16 items-center justify-between border-b border-[var(--line-soft)] px-4">
              <LogoLockup size="sm" href={homeHref} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                autoFocus
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <SidebarNav nav={nav} pathname={pathname} unreadCount={unreadCount} />
            <SidebarFooter user={user} />
          </div>
        </div>
      ) : null}

      {/* --- Main column ------------------------------------------------ */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--surface-card)_88%,transparent)] px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="lg:hidden">
            <LogoLockup size="xs" href={homeHref} />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <NotificationBell
              count={unreadCount}
              href={
                user.role === 'STUDENT'
                  ? '/student/notifications'
                  : '/manage/notifications'
              }
            />
            <UserMenu user={user} homeHref={homeHref} />
          </div>
        </header>

        {announcement ? (
          <div className="border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-center text-sm font-medium text-brand-900 dark:border-brand-900 dark:bg-brand-950/70 dark:text-brand-100 sm:px-6">
            {announcement}
          </div>
        ) : null}

        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <footer className="border-t border-[var(--line-soft)] px-4 py-5 text-center text-xs text-[var(--text-muted)] sm:px-6">
          Fodan College · …that they might have it abundantly
        </footer>
      </div>
    </div>
  );
}

function SidebarNav({
  nav,
  pathname,
  unreadCount,
}: {
  nav: NavSection[];
  pathname: string;
  unreadCount: number;
}) {
  return (
    <nav
      className="thin-scroll flex-1 overflow-y-auto px-3 py-4"
      aria-label="Main navigation"
    >
      {nav.map((section, index) => (
        <div key={section.title ?? `section-${index}`} className={index > 0 ? 'mt-5' : ''}>
          {section.title ? (
            <h2 className="mb-1.5 px-3 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {section.title}
            </h2>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-[var(--text-body)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-[1.125rem] shrink-0',
                        active ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-brand-600',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge === 'notifications' && unreadCount > 0 ? (
                      <Badge tone={active ? 'outline' : 'danger'} className={active ? 'text-white ring-white/40' : ''}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ user }: { user: AuthUser }) {
  return (
    <div className="border-t border-[var(--line-soft)] p-3">
      <div className="flex items-center gap-3 rounded-[var(--radius-field)] px-2 py-2">
        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
            {user.fullName}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {ROLE_LABELS[user.role]}
            {user.student?.className ? ` · ${user.student.className}` : ''}
          </p>
        </div>
      </div>
      <ThemeToggle className="mt-2 w-full justify-center sm:hidden" />
    </div>
  );
}

function UserMenu({ user, homeHref }: { user: AuthUser; homeHref: string }) {
  const profileHref =
    user.role === 'STUDENT' ? '/student/profile' : '/manage/profile';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-[var(--surface-sunken)]"
        >
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <span className="sr-only">Open account menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-bold normal-case text-[var(--text-strong)]">
            {user.fullName}
          </span>
          <span className="block truncate text-xs font-normal normal-case tracking-normal text-[var(--text-muted)]">
            @{user.username} · {ROLE_LABELS[user.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={homeHref}>Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={profileHref}>My profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/change-password">Change password</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild destructive>
          {/* A real form POST: signing out must never be reachable by a GET,
              or a stray link preview could log the user out. */}
          <form action="/api/auth/logout" method="post" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2.5">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact search field used in list headers. Submits as a GET so URLs share. */
export function SearchField({
  name = 'q',
  defaultValue = '',
  placeholder = 'Search…',
  action,
  hidden,
  className,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  action?: string;
  hidden?: Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <form action={action} className={cn('relative', className)}>
      {Object.entries(hidden ?? {}).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
        aria-hidden
      />
      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--surface-card)] pl-9 pr-3 text-sm focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none sm:w-64"
      />
    </form>
  );
}

/** Collapses a section of secondary controls on small screens. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn('mb-4', className)}>
      <Button
        variant="secondary"
        size="sm"
        className="sm:hidden"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <PanelLeftClose className="size-4" aria-hidden />
        {open ? 'Hide filters' : 'Filters'}
      </Button>
      <div
        className={cn(
          'mt-2 flex-wrap items-end gap-3 sm:mt-0 sm:flex',
          open ? 'flex' : 'hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}
