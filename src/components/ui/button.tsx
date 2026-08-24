'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The button.
 *
 * Sizes start at 40px tall (44px for `lg`) because a large share of this
 * platform's users are children on phones, and the WCAG target-size guidance is
 * a floor, not an aspiration. `loading` disables the control and swaps in a
 * spinner while keeping the label, so the layout never jumps and a screen
 * reader still knows what the button does.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold select-none',
    'transition-[background-color,color,box-shadow,transform] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-55',
    'active:translate-y-px',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-500',
        secondary:
          'bg-[var(--surface-card)] text-[var(--text-strong)] border border-[var(--line-strong)] hover:bg-[var(--surface-sunken)] focus-visible:outline-brand-500',
        subtle:
          'bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900 focus-visible:outline-brand-500',
        ghost:
          'text-[var(--text-body)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)] focus-visible:outline-brand-500',
        danger:
          'bg-danger-600 text-white shadow-sm hover:bg-danger-700 focus-visible:outline-danger-500',
        success:
          'bg-success-600 text-white shadow-sm hover:bg-success-700 focus-visible:outline-success-500',
        link: 'text-brand-700 underline-offset-4 hover:underline dark:text-brand-300 px-0',
      },
      size: {
        sm: 'h-9 rounded-[0.5rem] px-3 text-[0.8125rem]',
        md: 'h-10 rounded-[var(--radius-field)] px-4 text-sm',
        lg: 'h-11 rounded-[var(--radius-field)] px-6 text-[0.9375rem]',
        xl: 'h-13 rounded-xl px-8 text-base',
        icon: 'h-10 w-10 rounded-[var(--radius-field)]',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Announced while `loading` is true. */
  loadingLabel?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      loading = false,
      loadingLabel = 'Working…',
      iconLeft,
      iconRight,
      children,
      disabled,
      type,
      ...props
    },
    ref,
  ) {
    // `asChild` renders a link styled as a button; Slot forwards a single child,
    // so the spinner/icon composition below is skipped in that mode.
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, block }), className)}
          ref={ref as React.Ref<HTMLElement>}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span className="sr-only">{loadingLabel}</span>
          </>
        ) : (
          iconLeft
        )}
        {children}
        {!loading && iconRight}
      </button>
    );
  },
);

export { buttonVariants };
