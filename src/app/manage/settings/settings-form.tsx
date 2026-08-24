'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { updateSettingsAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Field, FieldSet, Toggle } from '@/components/ui/field';
import { Save } from 'lucide-react';

export function SettingsForm({
  definitions,
  categories,
  currentSettings,
}: {
  definitions: any[];
  categories: string[];
  currentSettings: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, null);

  const renderField = (def: any) => {
    const currentValue = currentSettings[def.key] ?? def.defaultValue;
    
    if (def.valueType === 'boolean') {
      return (
        <Toggle 
          key={def.key}
          name={def.key} 
          label={def.description}
          value="true"
          defaultChecked={currentValue === 'true'} 
        />
      );
    }

    return (
      <Field key={def.key} label={def.description}>
        <Input 
          name={def.key} 
          type={def.valueType === 'number' ? 'number' : 'text'} 
          defaultValue={currentValue} 
        />
      </Field>
    );
  };

  return (
    <form action={action} className="space-y-8">
      {categories.map(category => (
        <FieldSet key={category} legend={category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}>
          <div className="grid gap-6 sm:grid-cols-2 mt-4">
            {definitions.filter(d => d.category === category).map(renderField)}
          </div>
        </FieldSet>
      ))}

      {state?.ok === true && state.message && (
        <div className="rounded-md bg-success-50 p-4 text-sm text-success-700">
          {state.message}
        </div>
      )}
      
      {state?.ok === false && state.message && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.message}
        </div>
      )}

      <div className="flex items-center justify-end pt-4 border-t border-[var(--line-soft)]">
        <Button type="submit" loading={pending} iconLeft={<Save className="size-4" />}>
          Save Settings
        </Button>
      </div>
    </form>
  );
}
