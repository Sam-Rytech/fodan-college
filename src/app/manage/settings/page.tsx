import { type Metadata } from 'next';
import { guardStaff, requireRole } from '@/lib/auth/guards';

import { ROLES, SETTING_DEFINITIONS } from '@/lib/constants';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'System Settings' };

export default async function ManageSettingsPage() {
  const user = await guardStaff();
  requireRole(user, [ROLES.SUPER_ADMIN]);
  
  const currentSettings = await getSettings();

  // Group definitions by category
  const categories = Array.from(new Set(SETTING_DEFINITIONS.map(d => d.category)));

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          System Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Global configuration for the entire learning platform.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <SettingsForm 
          definitions={SETTING_DEFINITIONS} 
          categories={categories} 
          currentSettings={currentSettings} 
        />
      </div>
    </div>
  );
}
