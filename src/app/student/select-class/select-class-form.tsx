'use client';

import { useActionState, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/lib/actions';
import { selectClassAction } from '../actions';

interface ClassOption {
  id: string;
  name: string;
  level: string;
  description: string | null;
  _count: { subjects: number };
}

export function SelectClassForm({
  primary,
  secondary,
  currentClassId,
}: {
  primary: ClassOption[];
  secondary: ClassOption[];
  currentClassId: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(selectClassAction, null);

  const [selected, setSelected] = useState<string | null>(currentClassId);
  const failed = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-8">
      {failed ? <Alert tone="danger">{failed.error}</Alert> : null}

      {primary.length > 0 ? (
        <ClassGroup
          legend="Primary school"
          options={primary}
          selected={selected}
          onSelect={setSelected}
        />
      ) : null}

      {secondary.length > 0 ? (
        <ClassGroup
          legend="Secondary school"
          options={secondary}
          selected={selected}
          onSelect={setSelected}
        />
      ) : null}

      <div className="sticky bottom-0 -mx-4 border-t border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-4 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <Button
          type="submit"
          size="lg"
          block
          disabled={!selected}
          loading={pending}
          loadingLabel="Saving your class…"
          iconRight={<ArrowRight className="size-4" aria-hidden />}
        >
          {selected ? 'Continue' : 'Choose a class to continue'}
        </Button>
      </div>
    </form>
  );
}

function ClassGroup({
  legend,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  options: ClassOption[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
        {legend}
      </legend>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <ChoiceCard
            key={option.id}
            name="classId"
            value={option.id}
            type="radio"
            checked={selected === option.id}
            onChange={() => onSelect(option.id)}
            required
          >
            <span className="block font-bold text-[var(--text-strong)]">
              {option.name}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              {option._count.subjects} subject
              {option._count.subjects === 1 ? '' : 's'}
            </span>
          </ChoiceCard>
        ))}
      </div>
    </fieldset>
  );
}
