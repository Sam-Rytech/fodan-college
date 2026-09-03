import {
  Award,
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from 'lucide-react';
import { PERMISSIONS, ROLES, type PermissionKey, type RoleKey } from '@/lib/constants';
import { hasAnyPermission } from '@/lib/auth/rbac';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Navigation definition.
 *
 * Each entry declares the permissions it needs. `visibleNavFor` filters the
 * list, which is why an unauthorised section simply does not appear — but the
 * page behind it guards itself as well. Hiding a link is presentation; the
 * guard is the protection.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Any one of these permissions grants visibility. Empty means "always". */
  permissions?: PermissionKey[];
  roles?: RoleKey[];
  /** Match child routes too (e.g. /manage/students/abc highlights Students). */
  exact?: boolean;
  badge?: 'notifications';
}

export interface NavSection {
  title: string | null;
  items: NavItem[];
}

// -----------------------------------------------------------------------------
// Student
// -----------------------------------------------------------------------------

export const STUDENT_NAV: NavSection[] = [
  {
    title: null,
    items: [
      { href: '/student', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/student/subjects', label: 'Subjects', icon: Library },
      { href: '/student/lessons', label: 'Lessons', icon: BookOpen },
    ],
  },
  {
    title: 'Assessment',
    items: [
      { href: '/student/exams', label: 'Examinations', icon: FileText },
      { href: '/student/results', label: 'My results', icon: Award },
    ],
  },
  {
    title: 'Community',
    items: [
      { href: '/forum', label: 'Class forum', icon: MessagesSquare },
      {
        href: '/student/notifications',
        label: 'Notifications',
        icon: BellRing,
        badge: 'notifications',
      },
    ],
  },
  {
    title: 'Account',
    items: [{ href: '/student/profile', label: 'My profile', icon: UserCircle }],
  },
];

// -----------------------------------------------------------------------------
// Administrators (Super Admin and Mini Admin share this tree)
// -----------------------------------------------------------------------------

export const MANAGE_NAV: NavSection[] = [
  {
    title: null,
    items: [
      { href: '/manage', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      {
        href: '/manage/tasks',
        label: 'Tasks',
        icon: ClipboardList,
        // A Mini Admin always sees their own task list; manage_tasks is what
        // allows *assigning* work to someone else.
      },
    ],
  },
  {
    title: 'People',
    items: [
      {
        href: '/manage/students',
        label: 'Students',
        icon: GraduationCap,
        permissions: [PERMISSIONS.MANAGE_STUDENTS],
      },
      {
        href: '/manage/admins',
        label: 'Administrators',
        icon: ShieldCheck,
        permissions: [PERMISSIONS.MANAGE_ADMINS],
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        href: '/manage/access-codes',
        label: 'Access codes',
        icon: KeyRound,
        permissions: [PERMISSIONS.MANAGE_CODES],
      },
    ],
  },
  {
    title: 'Academics',
    items: [
      {
        href: '/manage/classes',
        label: 'Classes',
        icon: Users,
        permissions: [PERMISSIONS.MANAGE_CLASSES],
      },
      {
        href: '/manage/subjects',
        label: 'Subjects & topics',
        icon: Library,
        permissions: [PERMISSIONS.MANAGE_SUBJECTS],
      },
      {
        href: '/manage/materials',
        label: 'Learning materials',
        icon: FolderOpen,
        permissions: [PERMISSIONS.UPLOAD_MATERIALS],
      },
    ],
  },
  {
    title: 'Assessment',
    items: [
      {
        href: '/manage/examinations',
        label: 'Examinations',
        icon: FileText,
        permissions: [PERMISSIONS.MANAGE_EXAMS],
      },
      {
        href: '/manage/results',
        label: 'Results & analytics',
        icon: BarChart3,
        permissions: [PERMISSIONS.VIEW_RESULTS],
      },
    ],
  },
  {
    title: 'Community',
    items: [
      { href: '/forum', label: 'Forum', icon: MessagesSquare },
      {
        href: '/manage/forum',
        label: 'Moderation',
        icon: ShieldCheck,
        permissions: [PERMISSIONS.MANAGE_FORUM],
      },
      {
        href: '/manage/notifications',
        label: 'Notifications',
        icon: BellRing,
        badge: 'notifications',
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        href: '/manage/audit',
        label: 'Audit log',
        icon: ScrollText,
        permissions: [PERMISSIONS.VIEW_AUDIT_LOGS],
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        href: '/manage/settings',
        label: 'Settings',
        icon: Settings,
        permissions: [PERMISSIONS.MANAGE_SETTINGS],
        roles: [ROLES.SUPER_ADMIN],
      },
      { href: '/manage/profile', label: 'My profile', icon: UserCircle },
    ],
  },
];

// -----------------------------------------------------------------------------
// Filtering
// -----------------------------------------------------------------------------

export function navFor(user: AuthUser): NavSection[] {
  const sections = user.role === ROLES.STUDENT ? STUDENT_NAV : MANAGE_NAV;

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isVisible(item, user)),
    }))
    .filter((section) => section.items.length > 0);
}

function isVisible(item: NavItem, user: AuthUser): boolean {
  if (item.roles && !item.roles.includes(user.role)) return false;
  if (!item.permissions || item.permissions.length === 0) return true;
  return hasAnyPermission(user, item.permissions);
}

/** Highlights a nav entry, treating child routes as part of the section. */
export function isActivePath(
  pathname: string,
  href: string,
  exact = false,
): boolean {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
