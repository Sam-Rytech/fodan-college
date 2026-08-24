import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  Database,
  FileCheck2,
  Headphones,
  LogIn,
  Monitor,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Logo, LogoLockup } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathFor } from '@/lib/auth/guards';
import { BRAND } from '@/lib/constants';

export default async function LandingPage() {
  // Signed-in visitors get a direct route back to their own dashboard rather
  // than a marketing page they have already read.
  const user = await getCurrentUser();
  const dashboardHref = user ? homePathFor(user) : null;

  return (
    <div className="min-h-dvh bg-[var(--surface-page)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line-soft)] bg-[color-mix(in_srgb,var(--surface-card)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
          <LogoLockup size="sm" href="/" priority />
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            {dashboardHref ? (
              <Button asChild size="sm">
                <Link href={dashboardHref}>
                  My dashboard
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {/* --- Hero --------------------------------------------------- */}
        <section className="brand-wash relative overflow-hidden">
          <div className="grid-paper absolute inset-0 opacity-60" aria-hidden />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div className="animate-fade-up">
              <Badge tone="brand" className="mb-5">
                <Sparkles className="size-3.5" aria-hidden />
                Primary &amp; Secondary · Fodan College
              </Badge>

              <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--text-strong)] sm:text-5xl lg:text-6xl">
                Every lesson,
                <br />
                <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-spark-500 bg-clip-text text-transparent">
                  ready when you are.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--text-body)] sm:text-lg">
                Videos, notes, presentations and past questions for English
                Language, Mathematics, Computer Studies and Data Processing —
                with real examinations, instant results and a class forum where
                nobody studies alone.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {dashboardHref ? (
                  <Button asChild size="xl">
                    <Link href={dashboardHref}>
                      Continue learning
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="xl">
                      <Link href="/register">
                        Create your account
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                    <Button asChild size="xl" variant="secondary">
                      <Link href="/login">
                        <LogIn className="size-4" aria-hidden />
                        I already have one
                      </Link>
                    </Button>
                  </>
                )}
              </div>

              <p className="mt-5 text-xs text-[var(--text-muted)]">
                Accounts are activated by the school with an access code, so only
                enrolled students reach the lessons.
              </p>
            </div>

            {/* Decorative crest panel */}
            <div className="relative hidden justify-center lg:flex">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500/20 to-spark-400/20 blur-3xl" aria-hidden />
              <div className="relative flex size-72 items-center justify-center rounded-[2rem] border border-[var(--line-soft)] bg-[var(--surface-card)] shadow-[var(--shadow-lift)]">
                <Logo size="2xl" decorative priority />
                <span className="absolute -bottom-4 rounded-full border border-[var(--line-soft)] bg-[var(--surface-card)] px-4 py-1.5 text-xs font-semibold italic text-[var(--text-muted)] shadow-sm">
                  {BRAND.motto}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* --- Subjects ----------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            The subjects we teach
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--text-muted)]">
            Each subject is broken into topics, and each topic holds the
            materials your teacher has prepared for your class.
          </p>

          <div className="stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SubjectTile
              icon={<BookOpen className="size-5" aria-hidden />}
              name="English Language"
              body="Grammar, comprehension, composition and oral English."
              tone="from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400"
            />
            <SubjectTile
              icon={<Calculator className="size-5" aria-hidden />}
              name="Mathematics"
              body="Number, algebra, geometry, statistics and problem solving."
              tone="from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-400"
            />
            <SubjectTile
              icon={<Monitor className="size-5" aria-hidden />}
              name="Computer Studies"
              body="Hardware, software, the internet and staying safe online."
              tone="from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400"
            />
            <SubjectTile
              icon={<Database className="size-5" aria-hidden />}
              name="Data Processing"
              body="Data and information, spreadsheets, databases and reports."
              tone="from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </section>

        {/* --- How it works ------------------------------------------- */}
        <section className="border-y border-[var(--line-soft)] bg-[var(--surface-card)]">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>

            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Step
                number={1}
                title="Register"
                body="Sign up with your email address or phone number and pick your class."
              />
              <Step
                number={2}
                title="Get activated"
                body="Your school gives you an access code. Enter it once and your subjects open."
              />
              <Step
                number={3}
                title="Study"
                body="Watch, listen, read and work through each topic at your own pace."
              />
              <Step
                number={4}
                title="Take the exam"
                body="Sit the examination online, submit, and see your score straight away."
              />
            </ol>
          </div>
        </section>

        {/* --- Features ------------------------------------------------ */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<PlayCircle className="size-5" aria-hidden />}
              title="Video lessons"
              body="Stream lesson videos that pick up exactly where you stopped, even on a slow connection."
            />
            <FeatureCard
              icon={<Headphones className="size-5" aria-hidden />}
              title="Audio and documents"
              body="Listen to recordings, read PDFs and open presentations without leaving the page."
            />
            <FeatureCard
              icon={<FileCheck2 className="size-5" aria-hidden />}
              title="Real examinations"
              body="A countdown timer, question navigation, autosaved answers and automatic submission."
            />
            <FeatureCard
              icon={<Award className="size-5" aria-hidden />}
              title="Results you understand"
              body="Score, percentage, grade and a breakdown of what you got right — the moment you submit."
            />
            <FeatureCard
              icon={<MessagesSquare className="size-5" aria-hidden />}
              title="Your class forum"
              body="Ask a question, help a classmate, and keep the discussion in your own class."
            />
            <FeatureCard
              icon={<ShieldCheck className="size-5" aria-hidden />}
              title="Safe by design"
              body="Passwords are never stored in readable form, and every account action is recorded."
            />
          </div>
        </section>

        {/* --- Call to action ------------------------------------------ */}
        {!dashboardHref ? (
          <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-6">
            <div className="brand-wash overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-brand-950 px-6 py-12 text-center text-white sm:px-12">
              <Logo size="xl" decorative className="mx-auto" />
              <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Ready to begin?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-brand-100">
                Create your account today. Your teacher will send the activation
                code that opens your subjects.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild size="xl" variant="secondary">
                  <Link href="/register">Create your account</Link>
                </Button>
                <Button
                  asChild
                  size="xl"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-[var(--line-soft)] bg-[var(--surface-card)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <LogoLockup size="xs" showMotto />
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            <p>
              Proprietor: {BRAND.proprietor} · {BRAND.phone}
            </p>
            <p className="mt-0.5">{BRAND.email}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SubjectTile({
  icon,
  name,
  body,
  tone,
}: {
  icon: React.ReactNode;
  name: string;
  body: string;
  tone: string;
}) {
  return (
    <Card interactive className="p-5">
      <span
        className={`mb-4 grid size-11 place-items-center rounded-xl bg-gradient-to-br ${tone}`}
        aria-hidden
      >
        {icon}
      </span>
      <h3 className="text-base font-bold">{name}</h3>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">{body}</p>
    </Card>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body: string;
}) {
  return (
    <li className="relative">
      <span
        className="grid size-10 place-items-center rounded-xl bg-brand-600 font-display text-lg font-extrabold text-white"
        aria-hidden
      >
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">{body}</p>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-5">
      <span
        className="mb-3 grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        aria-hidden
      >
        {icon}
      </span>
      <h3 className="text-[0.9375rem] font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
        {body}
      </p>
    </Card>
  );
}
