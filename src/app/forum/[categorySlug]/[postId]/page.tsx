import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Lock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardAuth } from '@/lib/auth/guards';
import { ROLES } from '@/lib/constants';
import { RichText } from '@/components/forum/rich-text';
import { ReplyForm } from './reply-form';
import { formatRelative } from '@/lib/utils';
import { initials } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  return { title: post ? post.title : 'Discussion' };
}

export default async function ForumPostPage({
  params,
}: {
  params: Promise<{ categorySlug: string; postId: string }>;
}) {
  const { categorySlug, postId } = await params;
  const user = await guardAuth();

  const category = await prisma.forumCategory.findUnique({
    where: { slug: categorySlug },
  });
  if (!category || !category.isActive) notFound();

  // Validate access
  if (user.role.key === ROLES.STUDENT && !category.isGlobal) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (profile?.classId !== category.classId) {
      redirect('/forum'); // Unauthorized
    }
  }

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { fullName: true } },
      replies: {
        where: { status: 'VISIBLE' },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { fullName: true } } },
      },
    }
  });

  if (!post || post.status !== 'VISIBLE' || post.categoryId !== category.id) notFound();

  // Increment view count asynchronously
  prisma.forumPost.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  const isSuspended = user.forumSuspendedUntil && new Date(user.forumSuspendedUntil) > new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6 pt-6 px-4">
      <div className="mb-4">
        <Link href={`/forum/${category.slug}`} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="size-4" /> Back to {category.name}
        </Link>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--line-soft)] bg-[var(--surface-card)] overflow-hidden">
        {/* OP */}
        <div className="p-6 border-b border-[var(--line-soft)] bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
              {initials(post.author.fullName)}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-strong)] flex items-center gap-2">
                {post.title}
                {post.isLocked && <Lock className="size-4 text-gray-500" />}
              </h1>
              <div className="text-xs text-[var(--text-muted)]">
                Posted by <span className="font-medium text-[var(--text-strong)]">{post.author.fullName}</span> • {formatRelative(post.createdAt)}
              </div>
            </div>
          </div>
          <div className="prose prose-sm max-w-none prose-brand text-[var(--text-strong)]">
            <RichText text={post.body} />
          </div>
        </div>

        {/* Replies */}
        <div className="divide-y divide-[var(--line-soft)]">
          {post.replies.map((reply) => (
            <div key={reply.id} className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                  {initials(reply.author.fullName)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-strong)]">{reply.author.fullName}</span> • {formatRelative(reply.createdAt)}
                </div>
              </div>
              <div className="prose prose-sm max-w-none prose-brand text-[var(--text-strong)] ml-11">
                <RichText text={reply.body} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {post.isLocked ? (
        <div className="flex items-center gap-2 p-4 rounded-md bg-gray-50 text-gray-600 border border-gray-200">
          <Lock className="size-4" /> This discussion is locked and cannot receive new replies.
        </div>
      ) : isSuspended ? (
        <div className="flex items-center gap-2 p-4 rounded-md bg-danger-50 text-danger-700 border border-danger-200">
          <AlertTriangle className="size-4" /> Your forum access is currently suspended.
        </div>
      ) : (
        <div className="mt-8">
          <ReplyForm postId={post.id} />
        </div>
      )}
    </div>
  );
}
