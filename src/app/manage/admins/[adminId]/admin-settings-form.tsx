'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { updateAdminSettingsAction } from '../actions';
import { Button } from '@/components/ui/button';
import { FieldSet, Checkbox } from '@/components/ui/field';

export function AdminSettingsForm({
  adminId,
  permissions,
  classes,
  subjects,
  assignedPermissions,
  assignedClasses,
  assignedSubjects,
}: {
  adminId: string;
  permissions: any[];
  classes: any[];
  subjects: any[];
  assignedPermissions: string[];
  assignedClasses: string[];
  assignedSubjects: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateAdminSettingsAction, null);

  React.useEffect(() => {
    if (state?.ok) {
      router.push('/manage/admins');
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.details : {};

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="userId" value={adminId} />
      
      <FieldSet legend="Access Controls">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-medium">Capabilities</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto p-3 border border-[var(--line-soft)] rounded-md">
              {permissions.map(p => (
                <Checkbox 
                  key={p.id} 
                  name="permissions" 
                  value={p.key} 
                  label={p.name} 
                  defaultChecked={assignedPermissions.includes(p.key)}
                />
              ))}
            </div>
            {errors?.permissions && <p className="mt-1 text-xs text-danger-600">{errors.permissions.join(', ')}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Class Scopes</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto p-3 border border-[var(--line-soft)] rounded-md">
              {classes.map(c => (
                <Checkbox 
                  key={c.id} 
                  name="classIds" 
                  value={c.id} 
                  label={c.name} 
                  defaultChecked={assignedClasses.includes(c.id)}
                />
              ))}
            </div>
            {errors?.classIds && <p className="mt-1 text-xs text-danger-600">{errors.classIds.join(', ')}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Subject Scopes</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto p-3 border border-[var(--line-soft)] rounded-md">
              {subjects.map(s => (
                <Checkbox 
                  key={s.id} 
                  name="subjectIds" 
                  value={s.id} 
                  label={s.name} 
                  defaultChecked={assignedSubjects.includes(s.id)}
                />
              ))}
            </div>
            {errors?.subjectIds && <p className="mt-1 text-xs text-danger-600">{errors.subjectIds.join(', ')}</p>}
          </div>
        </div>
      </FieldSet>

      {state?.ok === false && state.message && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line-soft)]">
        <Button variant="ghost" type="button" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save Settings
        </Button>
      </div>
    </form>
  );
}
