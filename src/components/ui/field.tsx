'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Form primitives.
 *
 * Accessibility is built in rather than left to each form: `Field` generates
 * the id, wires `htmlFor`, links the hint and the error through
 * `aria-describedby`, and sets `aria-invalid`. A form cannot forget to do it,
 * because there is no path that skips it.
 */

interface FieldContextValue {
  id: string;
  hintId: string;
  errorId: string;
  hasError: boolean;
  hasHint: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

function useField() {
  return React.useContext(FieldContext);
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const generated = React.useId();
  const id = htmlFor ?? generated;
  const messages = Array.isArray(error) ? error.filter(Boolean) : error ? [error] : [];
  const hasError = messages.length > 0;

  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      hintId: `${id}-hint`,
      errorId: `${id}-error`,
      hasError,
      hasHint: Boolean(hint),
    }),
    [id, hasError, hint],
  );

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('space-y-1.5', className)}>
        {label ? (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-[var(--text-strong)]"
          >
            {label}
            {required ? (
              <span className="ml-0.5 text-danger-600" aria-hidden>
                *
              </span>
            ) : null}
            {required ? <span className="sr-only"> (required)</span> : null}
          </label>
        ) : null}

        {children}

        {hint && !hasError ? (
          <p id={value.hintId} className="text-xs text-[var(--text-muted)]">
            {hint}
          </p>
        ) : null}

        {hasError ? (
          <p
            id={value.errorId}
            className="flex items-start gap-1.5 text-xs font-medium text-danger-600 dark:text-danger-500"
          >
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{messages.join(' ')}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function describedBy(field: FieldContextValue | null): string | undefined {
  if (!field) return undefined;
  const ids = [
    field.hasError ? field.errorId : null,
    field.hasHint && !field.hasError ? field.hintId : null,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

const controlBase = [
  'w-full rounded-[var(--radius-field)] border bg-[var(--surface-card)]',
  'px-3 text-sm text-[var(--text-strong)]',
  'placeholder:text-[var(--text-muted)]',
  'transition-[border-color,box-shadow] duration-150',
  'focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)]',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-[var(--surface-sunken)]',
].join(' ');

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { iconLeft?: React.ReactNode }
>(function Input({ className, iconLeft, id, ...props }, ref) {
  const field = useField();
  const control = (
    <input
      ref={ref}
      id={id ?? field?.id}
      aria-invalid={field?.hasError || undefined}
      aria-describedby={describedBy(field)}
      className={cn(
        controlBase,
        'h-10',
        field?.hasError
          ? 'border-danger-500 focus:border-danger-500'
          : 'border-[var(--line-strong)]',
        iconLeft && 'pl-9',
        className,
      )}
      {...props}
    />
  );

  if (!iconLeft) return control;

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        aria-hidden
      >
        {iconLeft}
      </span>
      {control}
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, id, rows = 4, ...props }, ref) {
  const field = useField();
  return (
    <textarea
      ref={ref}
      id={id ?? field?.id}
      rows={rows}
      aria-invalid={field?.hasError || undefined}
      aria-describedby={describedBy(field)}
      className={cn(
        controlBase,
        'py-2.5 leading-relaxed',
        field?.hasError
          ? 'border-danger-500 focus:border-danger-500'
          : 'border-[var(--line-strong)]',
        className,
      )}
      {...props}
    />
  );
});

/**
 * A native `<select>`, deliberately. It is keyboard accessible everywhere,
 * renders as the platform picker on phones — which is what a child expects —
 * and needs no JavaScript to work.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, id, children, ...props }, ref) {
  const field = useField();
  return (
    <div className="relative">
      <select
        ref={ref}
        id={id ?? field?.id}
        aria-invalid={field?.hasError || undefined}
        aria-describedby={describedBy(field)}
        className={cn(
          controlBase,
          'h-10 appearance-none pr-9',
          field?.hasError
            ? 'border-danger-500 focus:border-danger-500'
            : 'border-[var(--line-strong)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path
          d="m6 8 4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label: React.ReactNode;
    description?: React.ReactNode;
  }
>(function Checkbox({ className, label, description, id, ...props }, ref) {
  const generated = React.useId();
  const inputId = id ?? generated;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          'mt-0.5 size-4 shrink-0 rounded border-[var(--line-strong)] text-brand-600',
          'accent-[var(--color-brand-600)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        )}
        {...props}
      />
      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className="cursor-pointer text-sm font-medium text-[var(--text-strong)]"
        >
          {label}
        </label>
        {description ? (
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
    </div>
  );
});

/** Styled as a toggle but backed by a checkbox, so it submits inside a form. */
export const Toggle = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label: React.ReactNode;
    description?: React.ReactNode;
  }
>(function Toggle({ className, label, description, id, ...props }, ref) {
  const generated = React.useId();
  const inputId = id ?? generated;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 rounded-[var(--radius-field)] border border-[var(--line-soft)] p-3 transition-colors hover:bg-[var(--surface-sunken)]',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-strong)]">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-[var(--line-strong)] transition-colors',
          'peer-checked:bg-brand-600',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500',
          "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-['']",
          'peer-checked:after:translate-x-5',
        )}
      />
    </label>
  );
});

/** Radio-style card, used for class pickers and answer options. */
export function ChoiceCard({
  checked,
  disabled,
  children,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }) {
  const generated = React.useId();
  const id = props.id ?? generated;

  return (
    <label
      htmlFor={id}
      className={cn(
        'group relative flex cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border-2 p-4 transition-all duration-150',
        checked
          ? 'border-brand-500 bg-brand-50 shadow-[var(--shadow-soft)] dark:bg-brand-950/60'
          : 'border-[var(--line-soft)] bg-[var(--surface-card)] hover:border-brand-300 hover:bg-[var(--surface-sunken)]',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        {...props}
        id={id}
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
          checked ? 'border-brand-600 bg-brand-600' : 'border-[var(--line-strong)]',
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </label>
  );
}

/** Groups related fields with an optional caption. */
export function FieldSet({
  legend,
  description,
  children,
  className,
}: {
  legend: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend className="text-sm font-bold text-[var(--text-strong)]">
        {legend}
      </legend>
      {description ? (
        <p className="-mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}
