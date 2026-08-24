import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { guardUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/constants';
import { PostForm } from './post-form';

export const metadata: Metadata = { title: 'New Discussion' };

export default async function NewForumPostPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  const user = await guardUser();

  const category = await prisma.forumCategory.findUnique({
    where: { slug: categorySlug },
  });

  if (!category || !category.isActive || category.isLocked) notFound();

  // Validate access
  if (user.role === ROLES.STUDENT && !category.isGlobal) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (profile?.classId !== category.classId) {
      redirect('/forum'); // Unauthorized
    }
  }

  if (user.forumSuspendedUntil && new Date(user.forumSuspendedUntil) > new Date()) {
    redirect(`/forum/${category.slug}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Start a Discussion
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Post in {category.name}. Keep it respectful and on-topic.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-6">
        <PostForm categoryId={category.id} categorySlug={category.slug} />
      </div>
    </div>
  );
}
