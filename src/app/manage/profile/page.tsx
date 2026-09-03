import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@/components/ui/card';
import { Avatar, DescriptionList } from '@/components/ui/misc';
import { ProfileForm } from '@/components/profile/profile-form';
import { guardStaff } from '@/lib/auth/guards';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/constants';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ManageProfilePage() {
  const user = await guardStaff();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My profile"
        description="Keep your personal information up to date."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-5 pt-6">
          <Avatar name={user.fullName} src={user.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">
              {user.fullName}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>
            <div className="mt-2 text-sm text-[var(--text-muted)]">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle as="h2">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            values={{
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
            }}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle as="h2">System record</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionList
            columns={2}
            items={[
              { term: 'Username', description: user.username },
              { term: 'Role', description: ROLE_LABELS[user.role] },
              { term: 'Joined', description: formatDate(user.createdAt) },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--text-strong)]">Password</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Last signed in {formatDateTime(user.lastLoginAt)}.
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
