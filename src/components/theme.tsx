'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Colour-scheme preference: light, dark, or follow the device.
 *
 * The choice is written to localStorage and applied by a tiny inline script in
 * the document head (`themeScript` below) BEFORE first paint — without that,
 * a dark-mode user sees a white flash on every navigation, which is genuinely
 * unpleasant at night and is the whole reason dark mode exists here.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'fodan-theme';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>('system');
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('light');

  // Read the stored preference after mount. Server and client agree on the
  // initial markup because the inline script has already set the class.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setPreferenceState(stored);
    }
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const next =
        preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      setResolved(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  const setPreference = React.useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage; the choice still applies for the
      // rest of the session, which is the best available outcome.
    }
  }, []);

  const value = React.useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Runs before hydration. Kept deliberately tiny and dependency-free; it is the
 * only inline script the application ships.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');var d=p==='dark'||((!p||p==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              'grid size-7 place-items-center rounded-full transition-colors',
              active
                ? 'bg-brand-600 text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{label} theme</span>
          </button>
        );
      })}
    </div>
  );
}
