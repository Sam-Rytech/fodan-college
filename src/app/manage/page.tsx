import type { Metadata } from 'next';
import { guardStaff } from '@/lib/auth/guards';
import { ROLES } from '@/lib/constants';
import { getMiniAdminDashboard, getSuperAdminDashboard } from '@/lib/data/admin';
import { SuperAdminDashboard } from './super-admin-dashboard';
import { MiniAdminDashboard } from './mini-admin-dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * One route, two dashboards.
 *
 * The Super Admin needs the whole school at a glance; a Mini Admin needs their
 * own work queue. Rendering both from the same path keeps navigation simple and
 * means neither role can wander into the other's view by editing the URL.
 */
export default async function ManageDashboardPage() {
  const user = await guardStaff();

  if (user.role === ROLES.SUPER_ADMIN) {
    const data = await getSuperAdminDashboard();
    return <SuperAdminDashboard data={data} user={user} />;
  }

  const data = await getMiniAdminDashboard(user);
  return <MiniAdminDashboard data={data} user={user} />;
}
