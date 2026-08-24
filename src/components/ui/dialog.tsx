'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * Modal dialogs, on Radix so focus trapping, escape handling, scroll locking
 * and `aria-modal` are correct without re-implementing them.
 *
 * On phones the panel docks to the bottom of the screen — a sheet is far easier
 * to reach one-handed than a centred box.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  size = 'md',
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  } as const;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--color-ink)_55%,transparent)] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden',
          'rounded-t-2xl border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-lift)]',
          'data-[state=open]:animate-fade-up',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-card)]',
          widths[size],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-[var(--line-soft)] px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <DialogPrimitive.Title className="font-display text-base font-bold text-[var(--text-strong)]">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-muted)]">
            {description}
          </DialogPrimitive.Description>
        ) : (
          // Radix warns when a dialog has no description; an empty, hidden one
          // keeps the console clean without inventing text for the reader.
          <DialogPrimitive.Description className="sr-only">
            {typeof title === 'string' ? title : 'Dialog'}
          </DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Close">
          <X className="size-4" aria-hidden />
        </Button>
      </DialogPrimitive.Close>
    </div>
  );
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('thin-scroll flex-1 overflow-y-auto px-5 py-4', className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-[var(--line-soft)] bg-[var(--surface-sunken)] px-5 py-3 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Confirmation dialog for destructive or irreversible actions.
 *
 * Used for every delete, revoke, disable and publish. `requireTyping` raises
 * the bar for the truly irreversible ones — the administrator must type the
 * subject's name, which makes an accidental click impossible.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  requireTyping,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  requireTyping?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [typed, setTyped] = React.useState('');
  const inputId = React.useId();

  React.useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const canConfirm =
    !loading && (!requireTyping || typed.trim() === requireTyping.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={title} description={description} />
        {requireTyping ? (
          <DialogBody>
            <label
              htmlFor={inputId}
              className="block text-sm text-[var(--text-body)]"
            >
              Type <span className="font-mono font-bold">{requireTyping}</span> to
              confirm.
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-2 h-10 w-full rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--surface-card)] px-3 text-sm focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none"
            />
          </DialogBody>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={loading}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
