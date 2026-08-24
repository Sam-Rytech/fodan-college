import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Alert, Badge } from '@/components/ui/feedback';
import { Avatar, DescriptionList } from '@/components/ui/misc';
import { ProfileForm } from '@/components/profile/profile-form';
import { guardStudent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'My profile' };

export default async function StudentProfilePage() {
  const user = await guardStudent();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { schoolClass: { select: { name: true, level: true } } },
  });

  const [lessonCount, resultCount] = await Promise.all([
    prisma.lessonProgress.count({
      where: { studentId: user.id, status: 'COMPLETED' },
    }),
    prisma.result.count({ where: { studentId: user.id } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My profile"
        description="Keep your details up to date so the school can reach you."
      />

      {/* --- Identity card --------------------------------------------- */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-5">
          <Avatar name={user.fullName} src={user.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">
              {user.fullName}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {profile?.schoolClass ? (
                <Badge tone="brand">{profile.schoolClass.name}</Badge>
              ) : (
                <Badge tone="warn">No class chosen</Badge>
              )}
              <Badge tone={profile?.isActivated ? 'success' : 'warn'} dot>
                {profile?.isActivated ? 'Activated' : 'Awaiting activation'}
              </Badge>
            </div>
          </div>
          <dl className="flex gap-6 text-center">
            <div>
              <dd className="font-display text-2xl font-extrabold text-[var(--text-strong)]">
                {lessonCount}
              </dd>
              <dt className="text-xs text-[var(--text-muted)]">Lessons done</dt>
            </div>
            <div>
              <dd className="font-display text-2xl font-extrabold text-[var(--text-strong)]">
                {resultCount}
              </dd>
              <dt className="text-xs text-[var(--text-muted)]">Exams taken</dt>
            </div>
          </dl>
        </CardContent>
      </Card>

      {!profile?.isActivated ? (
        <Alert tone="warn" className="mb-6" title="Your account is not activated">
          <p>Enter your access code to unlock lessons and examinations.</p>
          <Button asChild size="sm" variant="secondary" className="mt-3">
            <Link href="/student/activate">Enter access code</Link>
          </Button>
        </Alert>
      ) : null}

      {/* --- Editable details ------------------------------------------ */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle as="h2">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            showGuardian
            values={{
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
              guardianName: profile?.guardianName ?? null,
              guardianPhone: profile?.guardianPhone ?? null,
              dateOfBirth: profile?.dateOfBirth
                ? profile.dateOfBirth.toISOString().slice(0, 10)
                : null,
              gender: profile?.gender ?? null,
            }}
          />
        </CardContent>
      </Card>

      {/* --- Read-only school record ----------------------------------- */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle as="h2">School record</CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Set by the school. Ask your teacher if anything is wrong.
          </p>
        </CardHeader>
        <CardContent>
          <DescriptionList
            columns={2}
            items={[
              { term: 'Username', description: user.username },
              {
                term: 'Class',
                description: profile?.schoolClass?.name ?? 'Not chosen yet',
              },
              {
                term: 'Level',
                description:
                  profile?.studentType === 'PRIMARY' ? 'Primary' : 'Secondary',
              },
              {
                term: 'Admission number',
                description: profile?.admissionNumber ?? 'Not issued',
              },
              {
                term: 'Activated on',
                description: profile?.activatedAt
                  ? formatDate(profile.activatedAt)
                  : 'Not activated',
              },
              {
                term: 'Joined',
                description: formatDate(user.createdAt),
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* --- Security --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-brand-600"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-[var(--text-strong)]">
                  Password
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Last signed in {formatDateTime(user.lastLoginAt)}. Nobody at the
                  school can read your password.
                </p>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/change-password">
                <KeyRound className="size-4" aria-hidden />
                Change password
              </Link>
            </Button>
          </div>

          <div className="border-t border-[var(--line-soft)] pt-4">
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" aria-hidden />
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
