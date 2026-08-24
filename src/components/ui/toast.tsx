'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toast notifications.
 *
 * Hand-rolled rather than pulled from a library: the whole surface is one
 * provider, one hook and one portal, and keeping it in-house means the live
 * region semantics are exactly right — assertive for errors so a failed save is
 * announced immediately, polite for everything else so a success message does
 * not interrupt a screen-reader user mid-sentence.
 */

export type ToastTone = 'success' | 'error' | 'warn' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastContextValue {
  toast: (input: {
    tone?: ToastTone;
    title: string;
    description?: string;
    durationMs?: number;
  }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return context;
}

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ tone = 'info', title, description, durationMs }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Errors linger: the reader may need to act on them.
      const ttl = durationMs ?? (tone === 'error' ? 8000 : 4500);

      setToasts((current) => [
        ...current.slice(-(MAX_VISIBLE - 1)),
        { id, tone, title, description, durationMs: ttl },
      ]);

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ttl),
      );
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const TONE_STYLES: Record<
  ToastTone,
  { icon: React.ComponentType<{ className?: string }>; accent: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: 'bg-success-600',
    iconClass: 'text-success-600 dark:text-success-500',
  },
  error: {
    icon: XCircle,
    accent: 'bg-danger-600',
    iconClass: 'text-danger-600 dark:text-danger-500',
  },
  warn: {
    icon: AlertTriangle,
    accent: 'bg-warn-500',
    iconClass: 'text-warn-600 dark:text-warn-500',
  },
  info: { icon: Info, accent: 'bg-brand-600', iconClass: 'text-brand-600 dark:text-brand-400' },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Two regions so assertive errors never queue behind polite messages. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end sm:justify-start"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts
          .filter((item) => item.tone !== 'error')
          .map((item) => (
            <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
          ))}
      </div>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[101] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end sm:justify-start"
        role="alert"
        aria-live="assertive"
      >
        {toasts
          .filter((item) => item.tone === 'error')
          .map((item) => (
            <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
          ))}
      </div>
    </>,
    document.body,
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const { icon: Icon, accent, iconClass } = TONE_STYLES[toast.tone];

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm animate-pop overflow-hidden rounded-[var(--radius-field)] border border-[var(--line-soft)] bg-[var(--surface-raised)] shadow-[var(--shadow-lift)]',
      )}
    >
      <span className={cn('w-1 shrink-0', accent)} aria-hidden />
      <div className="flex flex-1 items-start gap-3 p-3.5">
        <Icon className={cn('mt-0.5 size-5 shrink-0', iconClass)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--text-strong)]">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {toast.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="-m-1 rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">Dismiss notification</span>
        </button>
      </div>
    </div>
  );
}
