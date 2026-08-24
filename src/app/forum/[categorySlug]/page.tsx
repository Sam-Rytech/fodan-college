import { type Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Plus, MessageSquare, Pin, Lock, Users } from 'lucide-react';
import { prisma } from '@/lib/db';
import { guardUser } from '@/lib/auth/guards';
import { ROLES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TableWrap, Table, Thead, Th, Tbody, Tr, Td, TableEmpty } from '@/components/ui/table';
import { formatRelative } from '@/lib/utils';

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await prisma.forumCategory.findUnique({ where: { slug: categorySlug } });
  return { title: category ? `${category.name} Forum` : 'Forum Category' };
}

export default async function ForumCategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  const user = await guardUser();

  const category = await prisma.forumCategory.findUnique({
    where: { slug: categorySlug },
    include: { schoolClass: { select: { name: true } } },
  });

  if (!category || !category.isActive) notFound();

  // Validate access
  if (user.role.key === ROLES.STUDENT && !category.isGlobal) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (profile?.classId !== category.classId) {
      redirect('/forum'); // Unauthorized
    }
  }

  const posts = await prisma.forumPost.findMany({
    where: { categoryId: category.id, status: 'VISIBLE' },
    orderBy: [
      { isPinned: 'desc' },
      { lastReplyAt: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      author: { select: { fullName: true } },
    }
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-6 px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-3 ${category.isGlobal ? 'bg-brand-50 text-brand-600' : 'bg-blue-50 text-blue-600'}`}>
            {category.isGlobal ? <Users className="size-6" /> : <MessageSquare className="size-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
              {category.name}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {category.description || `Discussions for ${category.schoolClass?.name || 'everyone'}.`}
            </p>
          </div>
        </div>
        {!category.isLocked && (!user.forumSuspendedUntil || new Date(user.forumSuspendedUntil) < new Date()) && (
          <div className="flex items-center gap-3">
            <Button iconLeft={<Plus className="size-4" />} asChild>
              <Link href={`/forum/${category.slug}/new`}>New Discussion</Link>
            </Button>
          </div>
        )}
      </div>

      <TableWrap>
        <Table caption="List of forum posts">
          <Thead>
            <Tr>
              <Th>Topic</Th>
              <Th>Author</Th>
              <Th numeric>Replies</Th>
              <Th numeric>Views</Th>
              <Th>Activity</Th>
            </Tr>
          </Thead>
          <Tbody>
            {posts.length === 0 ? (
              <TableEmpty colSpan={5} message="No discussions yet. Be the first to post!" />
            ) : (
              posts.map((post) => (
                <Tr key={post.id} className={post.isPinned ? 'bg-blue-50/50' : ''}>
                  <Td className="font-medium text-[var(--text-strong)]">
                    <Link href={`/forum/${category.slug}/${post.id}`} className="hover:underline flex items-center gap-2">
                      {post.isPinned && <Pin className="size-3 text-blue-500" />}
                      {post.isLocked && <Lock className="size-3 text-gray-500" />}
                      {post.title}
                    </Link>
                  </Td>
                  <Td>{post.author.fullName}</Td>
                  <Td numeric>{post.replyCount}</Td>
                  <Td numeric>{post.viewCount}</Td>
                  <Td className="text-sm text-[var(--text-muted)]">
                    {post.lastReplyAt ? formatRelative(post.lastReplyAt) : formatRelative(post.createdAt)}
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
