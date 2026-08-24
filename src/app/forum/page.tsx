import { type Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Users } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Forum' };

export default async function ForumIndexPage() {
  const user = await guardUser();

  let classId: string | null = null;
  if (user.role === ROLES.STUDENT) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    classId = profile?.classId ?? null;
  }

  const categories = await prisma.forumCategory.findMany({
    where: {
      isActive: true,
      OR: [
        { isGlobal: true },
        ...(classId ? [{ classId }] : []),
        ...(user.role !== ROLES.STUDENT ? [{}] : []) // Staff see everything
      ],
    },
    orderBy: [
      { isGlobal: 'desc' },
      { orderIndex: 'asc' },
      { name: 'asc' }
    ],
    include: {
      schoolClass: { select: { name: true } },
      _count: { select: { posts: { where: { status: 'VISIBLE' } } } }
    }
  });

  // If student only has one specific category (plus maybe a global one), redirect them to their class category?
  // Let's just show the index anyway.

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-6 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Discussion Forums
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Ask questions, share knowledge, and connect with others.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(category => (
          <Link 
            key={category.id} 
            href={`/forum/${category.slug}`}
            className="flex flex-col rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`rounded-lg p-2 ${category.isGlobal ? 'bg-brand-50 text-brand-600' : 'bg-blue-50 text-blue-600'}`}>
                {category.isGlobal ? <Users className="size-5" /> : <MessageSquare className="size-5" />}
              </div>
              <h2 className="font-semibold text-[var(--text-strong)]">{category.name}</h2>
            </div>
            {category.description && (
              <p className="text-sm text-[var(--text-muted)] flex-1">{category.description}</p>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
              <span>{category.schoolClass ? category.schoolClass.name : 'Global'}</span>
              <span>{category._count.posts} posts</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
