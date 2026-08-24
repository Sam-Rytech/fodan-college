'use server';

import { revalidatePath } from 'next/cache';
import { actionSuccess, parseForm, runAction, type ActionResult } from '@/lib/actions';
import { forumPostSchema, forumReplySchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/guards';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function createPostAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<{ categorySlug: string; postId: string }>> {
  return runAction(async () => {
    const user = await requireUser();

    if (user.forumSuspendedUntil && new Date(user.forumSuspendedUntil) > new Date()) {
      throw new Error(`Your forum access is suspended until ${new Date(user.forumSuspendedUntil).toLocaleDateString()}.`);
    }

    await enforceRateLimit(RATE_LIMITS.forumPost, user.id);

    const input = parseForm(forumPostSchema, formData);

    const category = await prisma.forumCategory.findUnique({
      where: { id: input.categoryId },
    });
    
    if (!category || !category.isActive) {
      throw new Error('Category not found or inactive.');
    }

    // Verify access
    if (user.role === 'STUDENT' && !category.isGlobal) {
      const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
      if (profile?.classId !== category.classId) {
        throw new Error('You do not have access to post in this category.');
      }
    }

    const post = await prisma.forumPost.create({
      data: {
        title: input.title,
        body: input.body,
        categoryId: category.id,
        authorId: user.id,
      },
    });

    revalidatePath('/forum');
    revalidatePath(`/forum/${category.slug}`);
    
    return actionSuccess({ categorySlug: category.slug, postId: post.id }, 'Post created successfully.');
  });
}

export async function createReplyAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireUser();

    if (user.forumSuspendedUntil && new Date(user.forumSuspendedUntil) > new Date()) {
      throw new Error(`Your forum access is suspended until ${new Date(user.forumSuspendedUntil).toLocaleDateString()}.`);
    }

    await enforceRateLimit(RATE_LIMITS.forumPost, user.id);

    const input = parseForm(forumReplySchema, formData);

    const post = await prisma.forumPost.findUnique({
      where: { id: input.postId },
      include: { category: true },
    });
    
    if (!post || post.status !== 'VISIBLE') {
      throw new Error('Post not found or unavailable.');
    }

    if (post.isLocked) {
      throw new Error('This discussion is locked.');
    }

    await prisma.forumReply.create({
      data: {
        body: input.body,
        postId: post.id,
        authorId: user.id,
        parentReplyId: input.parentReplyId,
      },
    });
    
    // Update the post's last activity
    await prisma.forumPost.update({
      where: { id: post.id },
      data: { lastReplyAt: new Date() },
    });

    revalidatePath(`/forum/${post.category.slug}/${post.id}`);
    
    return actionSuccess(null, 'Reply posted successfully.');
  });
}
