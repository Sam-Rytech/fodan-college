'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { settingsSchema } from '@/lib/validation';
import { guardStaff, requireRole } from '@/lib/auth/guards';

import { ROLES, AUDIT_ACTIONS } from '@/lib/constants';
import { updateSettings } from '@/lib/settings';
import { recordAudit } from '@/lib/audit';

export async function updateSettingsAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guardStaff();
    requireRole(user, [ROLES.SUPER_ADMIN]); // Only Super Admin can change settings

    const rawData = Object.fromEntries(formData.entries());
    // All inputs are string keys.
    const input = settingsSchema.parse(rawData);

    const changes = await updateSettings(input as any, user.id);

    if (changes.length > 0) {
      await recordAudit({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        actor: user,
        targetType: 'system_settings',
        description: `Updated ${changes.length} system setting(s).`,
        metadata: { changes },
      });
    }

    revalidatePath('/manage/settings');
    return actionSuccess(null, 'System settings updated successfully.');
  });
}
