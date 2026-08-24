'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PASSWORD_SCORE_LABELS,
  checkPasswordPolicy,
  scorePassword,
  type PasswordContext,
} from '@/lib/password-policy';
import { Input } from './field';

/**
 * Password field with a reveal toggle and a live strength meter.
 *
 * The meter runs the *same* policy function the server runs before hashing, so
 * a password the meter accepts is never rejected on submit. The client copy is
 * convenience only — the server always re-checks.
 */
export function PasswordInput({
  showMeter = false,
  context,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  showMeter?: boolean;
  context?: PasswordContext;
}) {
  const [visible, setVisible] = React.useState(false);
  const [value, setValue] = React.useState(
    typeof props.defaultValue === 'string' ? props.defaultValue : '',
  );

  const policy = React.useMemo(
    () => (showMeter && value ? checkPasswordPolicy(value, context ?? {}) : null),
    [showMeter, value, context],
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          className={cn('pr-11', className)}
          onChange={(event) => {
            setValue(event.target.value);
            props.onChange?.(event);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          // Excluded from the tab order: it sits between the password field and
          // the submit button, and stepping through it every time is a nuisance.
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1 grid size-8 place-items-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {showMeter && value ? (
        <StrengthMeter value={value} problems={policy?.problems ?? []} />
      ) : null}
    </div>
  );
}

function StrengthMeter({
  value,
  problems,
}: {
  value: string;
  problems: string[];
}) {
  const score = scorePassword(value);
  const tones = [
    'bg-danger-500',
    'bg-danger-500',
    'bg-warn-500',
    'bg-spark-500',
    'bg-success-600',
  ];

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                index < score ? tones[score] : 'bg-[var(--surface-sunken)]',
              )}
            />
          ))}
        </div>
        <span className="w-16 shrink-0 text-right text-xs font-semibold text-[var(--text-muted)]">
          {PASSWORD_SCORE_LABELS[score]}
        </span>
      </div>

      {problems.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--text-muted)]">
          {problems.slice(0, 3).map((problem) => (
            <li key={problem} className="flex gap-1.5">
              <span aria-hidden>·</span>
              {problem}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs font-medium text-success-700 dark:text-success-500">
          That password meets every rule.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        Password strength: {PASSWORD_SCORE_LABELS[score]}
      </p>
    </div>
  );
}
