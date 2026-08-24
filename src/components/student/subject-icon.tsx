import {
  BookOpen,
  Calculator,
  Database,
  FileAudio,
  FileText,
  FileType2,
  Globe2,
  Headphones,
  Library,
  Monitor,
  Presentation,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import { MATERIAL_TYPES, type MaterialType } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Subject and material iconography.
 *
 * Subjects carry an `iconKey`/`colorKey` pair chosen by the administrator, so
 * the mapping lives here rather than being hard-coded per screen — adding a
 * subject never means editing a component.
 */

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  calculator: Calculator,
  monitor: Monitor,
  database: Database,
  globe: Globe2,
  book: Library,
};

export const SUBJECT_COLOR_KEYS = [
  'blue',
  'rose',
  'violet',
  'emerald',
  'amber',
  'cyan',
] as const;

const SUBJECT_COLORS: Record<string, string> = {
  blue: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
};

export function SubjectIcon({
  iconKey,
  colorKey = 'blue',
  size = 'md',
  className,
}: {
  iconKey: string;
  colorKey?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const Icon = SUBJECT_ICONS[iconKey] ?? Library;
  const boxes = { sm: 'size-9', md: 'size-11', lg: 'size-14' };
  const icons = { sm: 'size-4', md: 'size-5', lg: 'size-6' };

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        boxes[size],
        SUBJECT_COLORS[colorKey] ?? SUBJECT_COLORS.blue,
        className,
      )}
    >
      <Icon className={icons[size]} />
    </span>
  );
}

// -----------------------------------------------------------------------------
// Material types
// -----------------------------------------------------------------------------

const MATERIAL_ICONS: Record<MaterialType, LucideIcon> = {
  [MATERIAL_TYPES.PDF]: FileText,
  [MATERIAL_TYPES.DOCX]: FileType2,
  [MATERIAL_TYPES.PPTX]: Presentation,
  [MATERIAL_TYPES.VIDEO]: PlayCircle,
  [MATERIAL_TYPES.AUDIO]: Headphones,
};

const MATERIAL_COLORS: Record<MaterialType, string> = {
  [MATERIAL_TYPES.PDF]: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  [MATERIAL_TYPES.DOCX]:
    'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  [MATERIAL_TYPES.PPTX]:
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  [MATERIAL_TYPES.VIDEO]:
    'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  [MATERIAL_TYPES.AUDIO]:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};

export function MaterialIcon({
  type,
  size = 'md',
  className,
}: {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const key = (type as MaterialType) in MATERIAL_ICONS ? (type as MaterialType) : null;
  const Icon = key ? MATERIAL_ICONS[key] : FileAudio;
  const boxes = { sm: 'size-8', md: 'size-10', lg: 'size-12' };
  const icons = { sm: 'size-4', md: 'size-[1.125rem]', lg: 'size-5' };

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-lg',
        boxes[size],
        key ? MATERIAL_COLORS[key] : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
        className,
      )}
    >
      <Icon className={icons[size]} />
    </span>
  );
}
