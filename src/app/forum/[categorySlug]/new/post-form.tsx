'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import { createPostAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Input, Field, FieldSet, Textarea } from '@/components/ui/field';

export function PostForm({ categoryId, categorySlug }: { categoryId: string; categorySlug: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createPostAction, null);

  React.useEffect(() => {
    if (state?.ok && state.data) {
      router.push(`/forum/${state.data.categorySlug}/${state.data.postId}`);
    }
  }, [state, router]);

  const errors = state?.ok === false ? state.fieldErrors : {};

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="categoryId" value={categoryId} />
      
      <FieldSet legend="Discussion Content">
        <Field label="Title" error={errors?.title} required>
          <Input name="title" placeholder="What's on your mind?" autoFocus />
        </Field>
        
        <Field label="Message" error={errors?.body} required>
          <Textarea 
            name="body" 
            placeholder="Type your message here. Markdown is supported." 
            rows={8} 
          />
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Supports basic formatting: **bold**, _italic_, `code`, and &gt; quotes.
          </p>
        </Field>
      </FieldSet>

      {state?.ok === false && state.error && (
        <div className="rounded-md bg-danger-50 p-4 text-sm text-danger-700">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line-soft)]">
        <Button variant="ghost" type="button" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Post Discussion
        </Button>
      </div>
    </form>
  );
}
