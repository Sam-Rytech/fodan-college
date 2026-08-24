import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * The school crest.
 *
 * Rendered through next/image at its true aspect ratio (424 × 399) and never
 * stretched — `object-contain` inside a square box means every size below keeps
 * the proportions the school gave us. The crest is decorative wherever the name
 * appears beside it, so it is hidden from screen readers in that case to avoid
 * announcing "Fodan College" twice.
 */

const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  '2xl': 120,
} as const;

export type LogoSize = keyof typeof SIZES;

export function Logo({
  size = 'md',
  className,
  priority = false,
  decorative = false,
}: {
  size?: LogoSize;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const px = SIZES[size];

  return (
    <Image
      src={BRAND.logo}
      alt={decorative ? '' : `${BRAND.name} crest`}
      aria-hidden={decorative || undefined}
      width={px}
      height={px}
      priority={priority}
      className={cn('object-contain', className)}
      style={{ width: px, height: px }}
    />
  );
}

/**
 * Crest plus wordmark. `href` makes the whole lockup a link back to the
 * appropriate home — pass the role's dashboard rather than always "/".
 */
export function LogoLockup({
  size = 'md',
  href,
  showMotto = false,
  className,
  priority = false,
}: {
  size?: LogoSize;
  href?: string;
  showMotto?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const nameClass =
    size === 'xs' || size === 'sm'
      ? 'text-sm'
      : size === 'md'
        ? 'text-base'
        : size === 'lg'
          ? 'text-lg'
          : 'text-2xl';

  const content = (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Logo size={size} decorative priority={priority} />
      <span className="min-w-0">
        <span
          className={cn(
            'block font-display font-extrabold leading-tight tracking-tight text-[var(--text-strong)]',
            nameClass,
          )}
        >
          {BRAND.name}
        </span>
        {showMotto ? (
          <span className="block text-[0.6875rem] italic leading-tight text-[var(--text-muted)]">
            {BRAND.motto}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="inline-flex rounded-lg outline-offset-4 transition-opacity hover:opacity-90"
    >
      {content}
    </Link>
  );
}

/**
 * Letterhead used at the top of printable reports (result slips, class sheets).
 * Kept here so a change to the crest or the motto updates print output too.
 */
export function ReportLetterhead({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-center gap-4 border-b-2 border-brand-600 pb-4',
        className,
      )}
    >
      <Logo size="lg" decorative />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold leading-tight text-[var(--text-strong)]">
          {BRAND.name}
        </p>
        <p className="text-xs italic text-[var(--text-muted)]">{BRAND.motto}</p>
        <p className="mt-1 text-[0.6875rem] text-[var(--text-muted)]">
          {BRAND.email} · {BRAND.phone}
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-sm font-bold text-[var(--text-strong)]">
          {title}
        </p>
        {subtitle ? (
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
