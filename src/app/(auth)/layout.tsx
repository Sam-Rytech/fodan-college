import Link from 'next/link';
import { GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo, LogoLockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme';
import { BRAND } from '@/lib/constants';

/**
 * Split layout for the unauthenticated screens.
 *
 * The left panel carries the crest and the school's promise; the right holds
 * the form. On phones the panel collapses to a compact header so the form is
 * the first thing a thumb reaches — sign-in on a small screen should never
 * require scrolling past decoration.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* --- Brand panel ------------------------------------------------ */}
      <aside className="brand-wash relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-10 text-white lg:flex">
        <div className="grid-paper absolute inset-0 opacity-40" aria-hidden />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3 rounded-lg">
            <Logo size="lg" decorative priority />
            <span>
              <span className="block font-display text-xl font-extrabold tracking-tight">
                {BRAND.name}
              </span>
              <span className="block text-xs italic text-brand-200">
                {BRAND.motto}
              </span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight">
            Learning that travels with you.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-100">
            Lessons, videos, past questions and examinations for Primary and
            Secondary students — on the laptop at school and the phone at home.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            <Feature
              icon={<GraduationCap className="size-4" aria-hidden />}
              title="Every subject in one place"
              body="English Language, Mathematics, Computer Studies and Data Processing."
            />
            <Feature
              icon={<Sparkles className="size-4" aria-hidden />}
              title="Study at your own pace"
              body="Pick up a lesson exactly where you left it and watch your progress fill in."
            />
            <Feature
              icon={<ShieldCheck className="size-4" aria-hidden />}
              title="Safe and supervised"
              body="Accounts are activated by the school, and every discussion is moderated."
            />
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">
          {BRAND.email} · {BRAND.phone}
        </p>
      </aside>

      {/* --- Form panel -------------------------------------------------- */}
      <main
        id="main"
        className="flex flex-col bg-[var(--surface-page)] px-5 py-8 sm:px-8"
      >
        <div className="flex items-center justify-between lg:hidden">
          <LogoLockup size="sm" href="/" showMotto />
          <ThemeToggle />
        </div>

        <div className="hidden justify-end lg:flex">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md animate-fade-up">{children}</div>
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-spark-300 ring-1 ring-white/15"
        aria-hidden
      >
        {icon}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-brand-200">{body}</span>
      </span>
    </li>
  );
}
